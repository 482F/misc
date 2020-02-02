#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
#
# mysqldump --skip-extended-insert の出力ファイルのパスを引数に取り、
# 連続した複数の INSERT を一文に変換して標準出力に出力するプログラムです。
# sql に読み込むことができない変更が行われる場合があるため、--check オプションで実行結果を確認してください。
#
# 使用法: ./connect_consecutive_insert.py [--check] filepath

import sys
import os
import re
import subprocess
import time

path = sys.argv[1]
is_check = False

if path == "--check":
    path = sys.argv[2]
    is_check = True

with open(path) as f:
    body = f.readlines()

result = ""
was_insert = False
last_command = None

# path の中身を一行ごとにループ
for line in body:
    # 行頭が INSERT なら
    if re.match("^INSERT", line):
        # INSERT ~ VALUES とその後のカッコをそれぞれ command, values に代入
        match = re.match("^(.*? VALUES) (\(.*\));$", line)
        command = match.group(1)
        values = match.group(2)
        # 前の行が INSERT であり、前の行と INSERT ~ VALUES が同一であれば
        # 前の行の行末をセミコロンからカンマに変更し、現在の行の INSERT ~ VALUES を削除する
        if was_insert and command == last_command:
            result = result[:-2] + ",\n"
            line = values + ";\n"
        # 次の行で使う was_insert と last_command を作成
        was_insert = True
        last_command = command
    # 行頭が INSERT でなかったら was_insert を False にし、last_command の中身を消す
    else:
        was_insert = False
        last_command = None
    result += line

result = result[:-1]

if is_check:
    tmp_path = "/tmp/" + os.path.basename(sys.argv[0]) + str(time.time())
    with open(tmp_path, mode="w") as f:
        f.write(result)
    subprocess.check_call(["vimdiff", path, tmp_path])
    os.remove(tmp_path)
else:
    print(result)
