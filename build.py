#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
云悦酒店 App 自动打包脚本
用法：python build.py [版本类型]
  - 不传参：自动递增 versionCode，versionName 按 0.x 格式递增（0.3 -> 0.4）
  - 传 minor：递增 versionName 小数位（0.3 -> 0.4）
  - 传 major：递增 versionName 整数位（0.3 -> 1.0）

每次运行：
1. 自动递增版本号（versionCode +1，versionName 递增）
2. 构建前端 (npm run build)
3. 同步到安卓 (npx cap sync android)
4. 打包 APK (gradle assembleDebug)
5. 复制到 D:/教学app/ 并自动命名 云悦酒店-vX.X.apk
"""

import re
import os
import shutil
import subprocess
import sys

# 修复 Windows 控制台 GBK 编码问题
if sys.stdout.encoding and sys.stdout.encoding.lower() in ('gbk', 'cp936'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE = r"D:\教学app\hotel-app"
ANDROID = os.path.join(BASE, "android")
GRADLE_FILE = os.path.join(ANDROID, "app", "build.gradle")
OUTPUT_APK = os.path.join(ANDROID, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
DEST_DIR = r"D:\教学app"

SDK = r"D:\教学app\apk打包\android\sdk"
GRADLE = r"D:\教学app\apk打包\gradle\gradle-8.13\bin\gradle.bat"
JAVA_HOME = r"D:\教学app\java 21\jdk-21.0.12.1-hotspot"


def read_version():
    with open(GRADLE_FILE, encoding="utf-8") as f:
        content = f.read()
    vc = re.search(r"versionCode\s+(\d+)", content).group(1)
    vn = re.search(r'versionName\s+"([^"]+)"', content).group(1)
    return int(vc), vn


def bump_version(vc, vn, bump_type):
    """递增版本号，返回 (new_vc, new_vn)"""
    new_vc = vc + 1
    major, minor = vn.split(".")
    major, minor = int(major), int(minor)
    if bump_type == "major":
        major += 1
        minor = 0
    else:  # minor 或默认
        minor += 1
    new_vn = f"{major}.{minor}"
    return new_vc, new_vn


def write_version(vc, vn):
    with open(GRADLE_FILE, encoding="utf-8") as f:
        content = f.read()
    content = re.sub(r"versionCode\s+\d+", f"versionCode {vc}", content)
    content = re.sub(r'versionName\s+"[^"]+"', f'versionName "{vn}"', content)
    with open(GRADLE_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    # 同步版本号到前端（我的页显示，便于支持时识别学生版本）
    with open(os.path.join(os.path.dirname(__file__), "src", "version.js"), "w", encoding="utf-8") as f:
        f.write(f"// 由 build.py 自动生成\nexport const APP_VERSION = '{vn}'\nexport const APP_VERSION_CODE = {vc}\n")


def run(cmd, cwd=None, env=None):
    print(f"\n>>> {cmd}")
    r = subprocess.run(cmd, shell=True, cwd=cwd, env=env)
    if r.returncode != 0:
        print(f"!!! 命令失败: {cmd}")
        sys.exit(1)


def main():
    bump_type = sys.argv[1] if len(sys.argv) > 1 else "minor"

    old_vc, old_vn = read_version()
    new_vc, new_vn = bump_version(old_vc, old_vn, bump_type)
    print(f"版本递增: {old_vn} (vc {old_vc}) -> {new_vn} (vc {new_vc})")
    write_version(new_vc, new_vn)

    env = os.environ.copy()
    env["ANDROID_HOME"] = SDK
    env["ANDROID_SDK_ROOT"] = SDK
    env["JAVA_HOME"] = JAVA_HOME

    # 1. 构建前端
    run("npm run build", cwd=BASE, env=env)
    # 2. 同步
    run("npx cap sync android", cwd=BASE, env=env)
    # 3. 打包
    run(f'"{GRADLE}" assembleDebug', cwd=ANDROID, env=env)

    # 4. 复制并命名
    dest = os.path.join(DEST_DIR, f"云悦酒店-v{new_vn}.apk")
    shutil.copy(OUTPUT_APK, dest)
    print(f"\n✅ 打包完成: {dest}")
    print(f"   版本号: versionCode={new_vc}, versionName={new_vn}")


if __name__ == "__main__":
    main()
