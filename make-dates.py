#!/usr/bin/env python3
#example: スクリーンショット_2021-01-01_104535.jpg
#   pattern: (?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})_(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})
#   after: {year}/{month}/{day} {hour}:{minute}:{second}
#   result:スクリーンショット_2021-01-01_104535.jpg,2021/01/01 10:45:35
#
#command: python3 ./make-dates.py "(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})_(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})" "{year}/{month}/{day} {hour}:{minute}:{second}" "*.jpg"

import re
import glob
import sys
import os

args = sys.argv
if len(args) < 4:
    os.exit(1)
pattern = args[1]
after = args[2]
targets = args[3:]

file_paths = []

for target in targets:
    file_paths += glob.glob(target)

result=""

for file_path in file_paths:
    m = re.search(pattern, file_path)
    date_str = ""
    result += file_path + ","
    if m != None:
        md = m.groupdict()
        year = md.get("year", "")
        month = md.get("month", "")
        day = md.get("day", "")
        hour = md.get("hour", "")
        minute = md.get("minute", "")
        second = md.get("second", "")
        date_str = after.format(year=year, month=month, day=day, hour=hour, minute=minute, second=second)
        result += date_str
    result += "\n"

print(result[:-1])
