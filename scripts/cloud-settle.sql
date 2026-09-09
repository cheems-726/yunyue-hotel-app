-- 云端自动结算系统 v1（settlement.js 的 PL/pgSQL 移植）
-- 设计：凌晨2点 pg_cron 调 settle_all_groups()，对每组执行与前端同口径的结算
-- 结果写入 game_states.state 内（report 结构与前端完全一致），前端登录即拉取展示

-- 固定种子伪随机（与 JS 版 seededRandom 同算法：s = s*16807 % 2147483647）
create or replace function public.rand_next(s bigint) returns bigint language sql immutable as $$
  select ((s * 16807) % 2147483647);
$$;

create or replace function public.rand_float(s bigint) returns double precision language sql immutable as $$
  select ((s - 1)::double precision / 2147483646);
$$;

-- 单组结算：输入 state(jsonb) + week，返回新 report(jsonb)
create or replace function public.settle_group(p_state jsonb, p_week int, p_prev_good_rate double precision default null)
returns jsonb language plpgsql immutable as $$
declare
  v_rand bigint := (p_week * 100 + 7);
  v_site jsonb := coalesce(p_state->'location'->'attrs', '{}'::jsonb);
  v_brand jsonb := coalesce(p_state->'brand', '{}'::jsonb);
  v_decisions jsonb := coalesce(p_state->'doneDecisions', '{}'::jsonb);
  v_city_flow double precision;
  v_rent_cost double precision;
  v_competition double precision;
  v_base_price double precision;
  v_price double precision;
  v_price_comp double precision;
  v_good_rate double precision;
  v_marketing double precision := 0;
  v_volatility double precision;
  v_market_wave double precision;
  v_demand double precision;
  v_occupancy double precision;
  v_rooms int;
  v_occupied int;
  v_revenue double precision;
  v_fixed double precision;
  v_var_cost double precision := 60;
  v_marketing_cost double precision := 0;
  v_ota_commission double precision := 0;
  v_overbook_comp double precision := 0;
  v_event_fine double precision := 0;
  v_renovation_cost double precision := 0;
  v_total_cost double precision;
  v_profit double precision;
  v_review_count int;
  v_negative int := 0;
  v_negative_impact int;
  v_final_good double precision;
  v_events jsonb := '[]'::jsonb;
  v_insights jsonb := '[]'::jsonb;
  v_reviews jsonb := '[]'::jsonb;
  v_pricing text;
  v_overbook int;
  v_energy double precision;
  v_done_count int;
  v_pending_negatives int := 0;
  v_resolved_count int := 0;
  v_crisis text;
  v_review_status jsonb;
  v_r double precision;
  v_neg_texts text[] := array['「隔音太差了，隔壁半夜看电视听得一清二楚，完全没睡好。」','「前台办理入住等了半小时，体验很差。」','「房间卫生一般，床品有异味，期望落差大。」','「空调忽冷忽热，半夜被冻醒。」','「热水等了十分钟才来，洗澡体验差。」','「网络太慢，视频会议都开不了。」','「停车场要绕很远，前台也说不清楚。」','「房间设施老旧，和网上照片差距太大。」'];
  v_guest_names text[] := array['王先生 · 商务出差','李女士 · 家庭出游','张先生 · 旅行','刘女士 · 亲子','陈先生 · 商务出差','赵女士 · 度假','周先生 · 旅行'];

begin
  -- 口碑库状态（本地存于 state.reviews）
  v_review_status := coalesce(p_state->'reviewsLocal', '[]'::jsonb);

  -- [1] 选址系数
  v_city_flow := 0.5 + coalesce((v_site->>'客流')::int, 3) * 0.2;
  v_rent_cost := 35 + coalesce((v_site->>'租金')::int, 3) * 10;
  v_competition := 1.15 - coalesce((v_site->>'竞争')::int, 3) * 0.05;

  -- [2] 价格
  v_base_price := 300;
  if v_brand->>'price' ~ '[0-9]+-[0-9]+' then
    v_base_price := ((substring(v_brand->>'price' from '([0-9]+)-'))::int + (substring(v_brand->>'price' from '-([0-9]+)'))::int) / 2.0;
  end if;
  v_price := v_base_price;
  v_pricing := coalesce(v_decisions->>'pricing', '不跟降');
  if v_pricing = '跟降 10%' then v_price := v_base_price * 0.9; v_price_comp := 1.2;
  elsif v_pricing = '降价 20% 抢客' then v_price := v_base_price * 0.8; v_price_comp := 1.3;
  elsif v_pricing = '不跟降' then v_price_comp := 0.8;
  else v_price_comp := 1.0;
  end if;

  -- [2.5] 收益管理
  if v_decisions->>'revenue-mgmt' = '连住优惠' then v_price_comp := v_price_comp * 1.06;
  elsif v_decisions->>'revenue-mgmt' = '尾房闪购' then v_price := v_price * 0.93; v_price_comp := v_price_comp * 1.12;
  elsif v_decisions->>'revenue-mgmt' = '组合套餐' then v_price := v_price * 1.08;
  end if;
  -- [2.6] 协议客户
  if v_decisions->>'corporate' = '让利签约' then v_price := v_price * 0.95; v_price_comp := v_price_comp * 1.08; end if;
  -- [2.7] 改造投资（价格段乘数；成本分摊在成本段）
  if v_decisions->>'renovation' = '投150万改造' then v_price := v_price * 1.08; end if;

  -- [3] 口碑（跨周延续）
  if p_prev_good_rate is not null then v_good_rate := p_prev_good_rate / 100.0;
  elsif v_brand->>'name' is not null then v_good_rate := 0.85; else v_good_rate := 0.82;
  end if;
  if v_decisions->>'hygiene' = '停房深清洁' then v_good_rate := v_good_rate + 0.03; end if;
  if v_decisions ? 'quality-check' then
    if (v_decisions->'quality-check'->>0) = '隔音' then v_good_rate := v_good_rate + 0.015; end if;
    if (v_decisions->'quality-check'->>0) = '卫生' then v_good_rate := v_good_rate + 0.015; end if;
  end if;
  if v_decisions->>'member-convert' = '强调品质' then v_good_rate := v_good_rate + 0.02; end if;
  if v_decisions->>'hr-optimize' = '全员培训' then v_good_rate := v_good_rate + 0.02; end if;
  if v_decisions->>'report-diagnosis' = '解决口碑相关' then v_good_rate := v_good_rate + 0.015; end if;
  if v_decisions->>'reputation' = '道歉+赔偿' then v_good_rate := v_good_rate + 0.02; end if;
  if v_decisions->>'reputation' = '模板回复' then v_good_rate := v_good_rate - 0.03; end if;
  if v_decisions->>'hr-optimize' = '裁员1人' then v_good_rate := v_good_rate - 0.02; end if;
  v_energy := nullif(v_decisions->>'energy','')::double precision;
  if v_energy is not null and (v_energy <= 21 or v_energy >= 25) then v_good_rate := v_good_rate - 0.02; end if;
  -- 投入不足惩罚
  v_done_count := (select count(*) from jsonb_object_keys(v_decisions));
  if v_done_count < 9 then v_good_rate := v_good_rate - 0.02; end if;
  -- 欠差评惩罚（云端版从 reviewsLocal 聚合）
  select count(*) into v_pending_negatives from jsonb_array_elements(v_review_status) rx
    where rx->>'status' in ('pending','ignored');
  select count(*) into v_resolved_count from jsonb_array_elements(v_review_status) rx
    where rx->>'status' = 'resolved';
  v_good_rate := v_good_rate - v_pending_negatives * 0.03;
  -- 危机应对（crisisResponse 由前端存入 state）
  v_crisis := v_decisions->>'__crisisResponse';
  if v_crisis = '立即公开整改+补偿' then v_good_rate := v_good_rate + 0.02;
  elsif v_crisis = '逐条真诚回复' then v_good_rate := v_good_rate + 0.01;
  elsif v_crisis = '不理会' then v_good_rate := v_good_rate - 0.02;
  end if;
  v_good_rate := greatest(0.3, least(0.95, v_good_rate));

  -- [4] 营销
  if v_decisions ? 'campaign' then v_marketing := v_marketing + 0.15; end if;
  if v_decisions ? 'ota' then v_marketing := v_marketing + 0.08; end if;
  if v_decisions->>'member-convert' = '强调优惠' then v_marketing := v_marketing + 0.05; end if;

  -- [5] 市场波动（固定种子）
  v_volatility := 1 + coalesce((v_site->>'波动')::int, 3) * 0.02;
  v_rand := public.rand_next(v_rand);
  v_market_wave := (0.85 + public.rand_float(v_rand) * 0.3) * v_volatility;

  -- [6-7] 客源强度 → 出租率
  v_demand := v_price_comp
    * (case when v_good_rate >= 0.85 then 1.2 when v_good_rate >= 0.7 then 1.0 when v_good_rate >= 0.5 then 0.8 else 0.5 end)
    * (1 + v_marketing) * v_market_wave * v_city_flow * v_competition;
  v_occupancy := least(0.6 * v_demand, 0.98);
  v_overbook := coalesce(nullif(v_decisions->>'overbook','')::int, 0);
  if v_overbook > 0 then v_occupancy := least(v_occupancy + v_overbook * 0.015, 1.0); end if;
  v_occupancy := greatest(v_occupancy, 0.3);

  -- [7.5] 事件（与 JS 版完全同序：每个事件固定消耗一个 rand，保证两引擎结果一致）
  if v_occupancy >= 0.85 and v_decisions->>'shifts' = '精简省成本' then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.6 then
    v_negative := v_negative + 2;
    v_events := v_events || jsonb_build_object('type','bad','icon','🐢','name','满负荷·响应慢','text','出租率高但人手精简，客人投诉排队，新增 2 条差评','impact','差评 +2','tip','旺季保服务');
  end if; end if;
  if v_decisions->>'hygiene' <> '停房深清洁' and p_week >= 4 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.3 then
    v_negative := v_negative + 1;
    v_events := v_events || jsonb_build_object('type','bad','icon','🧹','name','卫生敷衍','text','连续未深清洁，客人发现布草污渍，新增 1 条差评','impact','差评 +1','tip','卫生是口碑底线');
  end if; end if;
  if v_price >= 320 and v_good_rate < 0.8 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.4 then
    v_negative := v_negative + 1;
    v_events := v_events || jsonb_build_object('type','bad','icon','💸','name','性价比失衡','text','房价高但口碑平平，客人吐槽不值','impact','差评 +1','tip','价格要和品质匹配');
  end if; end if;
  if coalesce((v_site->>'竞争')::int, 3) >= 4 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.35 then
    v_occupancy := greatest(v_occupancy * 0.9, 0.3);
    v_events := v_events || jsonb_build_object('type','bad','icon','🏪','name','竞店开业','text','附近新开酒店分走客流','impact','出租率 -10%','tip','靠口碑和会员留客');
  end if; end if;
  if v_good_rate >= 0.85 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.25 then
    v_good_rate := least(v_good_rate + 0.02, 0.95);
    v_events := v_events || jsonb_build_object('type','good','icon','📸','name','网红探店','text','探店博主推荐','impact','口碑 +2%','tip','好口碑带来免费流量');
  end if; end if;
  if v_decisions->>'member-convert' = '强调品质' then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.3 then
    v_events := v_events || jsonb_build_object('type','good','icon','🔁','name','会员复购潮','text','高品质会员带朋友复购','impact','—','tip','品质转化忠诚度高');
  end if; end if;
  if v_pending_negatives >= 2 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.4 then
    v_good_rate := greatest(v_good_rate - 0.03, 0.3);
    v_events := v_events || jsonb_build_object('type','crisis','icon','🔥','name','差评发酵','text',v_pending_negatives||' 条差评未处理被顶上热榜','impact','口碑 -3%','tip','不处理就上热榜');
  end if; end if;
  if v_resolved_count >= 2 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.5 then
    v_good_rate := least(v_good_rate + 0.02, 0.95);
    v_events := v_events || jsonb_build_object('type','good','icon','🙏','name','整改获认可','text','客人追加好评','impact','口碑 +2%','tip','整改不是白干');
  end if; end if;
  if v_decisions->>'hygiene' <> '停房深清洁' and p_week >= 6 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.25 then
    v_event_fine := 1500;
    v_events := v_events || jsonb_build_object('type','bad','icon','🧯','name','消防检查','text','消防突击检查罚款 1500 元','impact','成本 +1500元','tip','合规是底线成本');
  end if; end if;
  v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.12 then
    v_occupancy := greatest(v_occupancy * 0.95, 0.3);
    v_events := v_events || jsonb_build_object('type','bad','icon','🚱','name','市政停水半日','text','片区管网检修停水半天','impact','出租率 -5%','tip','不可抗力别慌');
  end if;
  if coalesce((v_site->>'客流')::int, 3) >= 4 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.3 then
    v_occupancy := least(v_occupancy + 0.05, 0.98);
    v_events := v_events || jsonb_build_object('type','good','icon','🎪','name','会展旺季','text','片区大型会展开幕','impact','出租率 +5%','tip','选址红利');
  end if; end if;
  if v_decisions ? 'ota' and v_good_rate >= 0.8 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.3 then
    v_good_rate := least(v_good_rate + 0.01, 0.95);
    v_events := v_events || jsonb_build_object('type','good','icon','🏅','name','OTA金牌商家','text','平台授予金牌标识','impact','口碑 +1%','tip','流量跟着口碑走');
  end if; end if;
  if v_decisions->>'shifts' = '满编保服务' and p_week >= 3 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.35 then
    v_good_rate := least(v_good_rate + 0.01, 0.95);
    v_events := v_events || jsonb_build_object('type','good','icon','🎂','name','员工关怀日','text','员工生日会带动服务热情','impact','口碑 +1%','tip','对员工好=对客人好');
  end if; end if;
  v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.2 then
    v_negative := v_negative + 1;
    v_events := v_events || jsonb_build_object('type','bad','icon','🌙','name','深夜噪音投诉','text','深夜聚会喧哗招差评','impact','差评 +1','tip','夜班主动巡场');
  end if;
  v_rand := public.rand_next(v_rand); if p_prev_good_rate is not null and p_prev_good_rate >= 85 then v_rand := public.rand_next(v_rand); if public.rand_float(v_rand) < 0.3 then
    v_good_rate := least(v_good_rate + 0.015, 0.95);
    v_events := v_events || jsonb_build_object('type','good','icon','🏆','name','片区评选获奖','text','行业协会年度评选获奖','impact','口碑 +1.5%','tip','长期主义被看见');
  end if; end if;

  -- [8] 营收
  v_rooms := 70;
  if v_brand->>'standard' ~ '[0-9]+间' then v_rooms := substring(v_brand->>'standard' from '([0-9]+)间')::int; end if;
  v_occupied := round(v_rooms * v_occupancy);
  v_revenue := round(v_occupied * v_price);

  -- [9] 成本
  v_fixed := v_rooms * v_rent_cost;
  if v_decisions->>'report-diagnosis' = '解决成本相关' then v_fixed := round(v_fixed * 0.95); end if;
  if v_decisions->>'hr-optimize' = '裁员1人' then v_fixed := round(v_fixed * 0.9); end if;
  if v_decisions->>'linen' = '自洗' then v_var_cost := 52; end if;
  if v_decisions->>'linen' = '外包' then v_var_cost := 66; end if;
  if v_decisions->>'shifts' = '满编保服务' then v_var_cost := v_var_cost + 18;
  elsif v_decisions->>'shifts' = '精简省成本' then v_var_cost := v_var_cost - 12; end if;
  if v_energy is not null then v_var_cost := v_var_cost + (v_energy - 23) * 2; end if;
  if v_decisions ? 'campaign' then v_marketing_cost := 5000; end if;
  if v_decisions ? 'ota' then v_ota_commission := round(v_revenue * 0.11); end if;
  -- JS 语义：if (overbook > 0) 才消耗 rand（三元真→1个，假→2个）
  if v_overbook > 0 then
    v_rand := public.rand_next(v_rand);
    if public.rand_float(v_rand) < v_overbook * 0.08 then
      v_overbook_comp := v_overbook * round(v_price);
      v_negative := v_negative + 1;
    else
      v_rand := public.rand_next(v_rand);
      v_overbook_comp := greatest(0, round(v_overbook * 0.4 * public.rand_float(v_rand))) * round(v_price);
    end if;
  end if;
  if v_decisions->>'renovation' = '投150万改造' then v_renovation_cost := 2000; end if;
  v_total_cost := v_fixed + v_occupied * v_var_cost + v_marketing_cost + v_ota_commission + v_overbook_comp + v_event_fine + v_renovation_cost;

  -- [10] 利润
  v_profit := v_revenue - v_total_cost;

  -- [11] 评价
  v_review_count := round(v_occupied * 0.08);
  v_rand := public.rand_next(v_rand);
  for i in 1..v_review_count loop
    v_rand := public.rand_next(v_rand);
    if public.rand_float(v_rand) >= v_good_rate then v_negative := v_negative + 1; end if;
  end loop;

  -- [12-13] 处理影响
  v_negative_impact := v_negative;
  if v_decisions->>'reputation' in ('道歉+赔偿','解释原因') then v_negative_impact := round(v_negative * 0.5); end if;
  if v_review_count > 0 then v_final_good := round(((v_review_count - v_negative_impact)::numeric / v_review_count * 100));
  else v_final_good := round(v_good_rate * 100); end if;

  -- [14] insights（关键决策复盘）
  if v_pricing = '不跟降' and v_profit >= 0 then
    v_insights := v_insights || jsonb_build_object('good', true, 'text', '不跟降保住了单间利润，本周盈利');
  end if;
  if v_pricing = '降价 20% 抢客' and v_profit < 0 then
    v_insights := v_insights || jsonb_build_object('good', false, 'text', '降价抢客拉高了出租率，但利润被压垮');
  end if;
  if v_done_count < 18 then
    v_insights := v_insights || jsonb_build_object('good', false, 'text', '本周只完成 '||v_done_count||'/18 项决策，未做的按"维持现状"生效');
  end if;

  -- [15] 生成差评（回流口碑页）
  v_rand := public.rand_next(v_rand);
  for i in 0..least(v_negative, 3) - 1 loop
    v_rand := public.rand_next(v_rand);
    v_reviews := v_reviews || jsonb_build_object(
      'id', 'w'||p_week||'-n'||i, 'avatar','🧑','bg','blue',
      'name', v_guest_names[1 + floor(public.rand_float(v_rand) * 7)::int],
      'date', '第'||p_week||'周', 'stars', case when public.rand_float(v_rand) < 0.5 then 1 else 2 end,
      'text', v_neg_texts[1 + floor(public.rand_float(v_rand) * 8)::int],
      'status', 'pending', 'week', p_week
    );
  end loop;

  return jsonb_build_object(
    'week', p_week,
    'occupancy', round(v_occupancy * 100),
    'rooms', v_rooms, 'occupiedRooms', v_occupied,
    'price', round(v_price), 'revenue', v_revenue::int,
    'totalCost', v_total_cost::int, 'profit', v_profit::int,
    'goodRate', round(v_good_rate * 100), 'finalGoodRate', v_final_good,
    'reviewCount', v_review_count, 'negativeCount', v_negative,
    'demandStrength', round(v_demand::numeric, 2),
    'marketWave', round(v_market_wave::numeric, 2),
    'insights', v_insights, 'events', v_events,
    'decisions', v_decisions,
    'eventFine', v_event_fine::int, 'overbookCompensation', v_overbook_comp::int,
    'generatedReviews', v_reviews,
    'settledBy', 'cloud'
  );
end $$;

-- 全组结算：凌晨2点由 pg_cron 调用（防重入：当日已结算跳过）
create or replace function public.settle_all_groups()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  v_state jsonb;
  v_week int;
  v_history jsonb;
  v_report jsonb;
  v_prev_good double precision;
  v_settled int := 0;
  v_skipped int := 0;
  v_results jsonb := '[]'::jsonb;
  v_today date := current_date;
begin
  -- 防重入：当日已跑过则跳过（settle_runs 表）
  insert into public.settle_runs (run_date, status, started_at)
  values (v_today, 'running', now())
  on conflict (run_date) do nothing;
  if not exists (select 1 from public.settle_runs where run_date = v_today and status = 'running' and started_at > now() - interval '10 minutes') then
    return jsonb_build_object('skipped', true, 'reason', 'already ran today');
  end if;

  for rec in select user_id, state, week from public.game_states where finished = false loop
    v_state := rec.state;
    v_week := rec.week;
    v_history := coalesce(v_state->'history', '[]'::jsonb);
    -- 该周已有 report 未确认（学生未点"进入下一周"）或历史已含该周 → 跳过（学生自走节奏）
    if v_state ? 'report' and v_state->'report' is not null then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_prev_good := null;
    if jsonb_array_length(v_history) > 0 then
      v_prev_good := (v_history->(jsonb_array_length(v_history)-1)->>'finalGoodRate')::double precision;
    end if;
    -- 云端结算：全班统一周模式下才自动结算（class_state.current_week = v_week）
    if (select current_week from public.class_state where id = 1) = v_week then
      v_report := public.settle_group(v_state, v_week, v_prev_good);
      v_state := jsonb_set(v_state, '{report}', v_report);
      -- 差评回流：追加到 reviewsLocal
      if jsonb_array_length(coalesce(v_report->'generatedReviews','[]'::jsonb)) > 0 then
        v_state := jsonb_set(v_state, '{reviewsLocal}',
          coalesce(v_state->'reviewsLocal','[]'::jsonb) || (v_report->'generatedReviews'));
      end if;
      update public.game_states set state = v_state, updated_at = now() where user_id = rec.user_id;
      v_settled := v_settled + 1;
      v_results := v_results || jsonb_build_object('uid', rec.user_id, 'week', v_week, 'profit', v_report->>'profit');
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  update public.settle_runs set status = 'done', settled = v_settled, skipped = v_skipped, results = v_results, finished_at = now()
  where run_date = v_today;
  return jsonb_build_object('settled', v_settled, 'skipped', v_skipped);
end $$;

-- 结算运行日志表
create table if not exists public.settle_runs (
  run_date date primary key,
  status text not null default 'running',
  settled int default 0,
  skipped int default 0,
  results jsonb default '[]',
  started_at timestamptz,
  finished_at timestamptz
);
alter table public.settle_runs enable row level security;
create policy "settle_runs_teacher_read" on public.settle_runs for select using (public.is_teacher(auth.uid()));
