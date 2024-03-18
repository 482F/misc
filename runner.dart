/*
TODO:
行区切りではなく、書いてあるコマンドをそのまま実行したい
コンパイル後の実行ファイルを起動したときにコマンドラインウィンドウが出ないようにしたい -> editbin.exe
コンパイル後の実行ファイルのアイコンを変更したい
*/
import 'dart:io' as io;

void main(List<String> args) async {
  final scriptDir =
      io.Platform.script.toFilePath().replaceFirst(RegExp(r'[^\\\/]+$'), '');

  final lines = await io.File(scriptDir + 'run.txt').readAsLines();
  final exe = lines[0];
  final rargs = lines.sublist(1);

  final process = await io.Process.start(exe, rargs + args,
      runInShell: true, mode: io.ProcessStartMode.inheritStdio);
  await process.exitCode;
}
