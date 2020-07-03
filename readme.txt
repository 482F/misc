- 実行には ffmpeg と bc が必要
- foo.txt を用意し、以下のようにする
```
0:00,a
1:00,b
2:00,c
```
- ./mp3-trimmer.sh bar.mp3 foo.txt を実行する
- a.mp3, b.mp3, c.mp3 が出力される
  - a.mp3 は bar.mp3 の 0:00-1:00、b.mp3 は bar.mp3 の 1:00-2:00、c.mp3 は bar.mp3 の 2:00-最後までである
