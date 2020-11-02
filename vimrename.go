package main
import (
    "strings"
    "fmt"
    "log"
    "flag"
    "path/filepath"
    "os"
    "io/ioutil"
    "os/exec"
)

type FilePath struct{
    Path string
    Directory string
    Name string
    isEdited bool
}

func newFilePath(path string) *FilePath{
    filePath := new(FilePath)
    filePath.Path = path
    filePath.Directory, filePath.Name = filepath.Split(filePath.Path)
    filePath.isEdited = false
    return filePath
}

func (fp *FilePath) setName(name string){
    fp.Name = name
    fp.isEdited = true
}

func (fp *FilePath) move(){
    if fp.isEdited{
        err := os.Rename(fp.Path, fp.Directory + fp.Name)
        checkErr(err)
    }
}

func (fp *FilePath) readArr(newName string) {
    if (newName == ""){
        return
    }
    if (fp.Name != newName){
        fp.setName(newName)
    }
}

func writeFiles(fps []*FilePath) []string{
    files := []string{"", ""}
    for _, fp := range fps{
        files[0] += fp.Name + "\n"
    }
    files[1] = files[0]
    return files
}

func readFile(fps []*FilePath, tmpFile string){
    names := strings.Split(tmpFile + strings.Repeat("\n", len(fps)), "\n")
    for ind, fp := range fps{
        fp.readArr(names[ind])
    }
}

func checkErr(err error){
    if err != nil{
        log.Fatal(err)
    }
}

func openTmpFiles(paths []string){
    cmd := exec.Command("vim", "-c", "nnoremap <S-Tab> W| :nnoremap <Tab> w", "-c", "set scrollbind | :set cursorbind | :set nowrap | :set fenc=utf-8", "-c", "normal ", "-c", "set scrollbind | :set cursorbind | :set nowrap | :set fenc=utf-8", "-c", "normal ", "-c", "set scrollbind | :set cursorbind | :set nowrap | :set fenc=utf-8", "-c", "normal ", "-c", "set scrollbind | :set cursorbind | :set nowrap | :set fenc=utf-8", "-c", "normal ", "-O", paths[0], paths[1])
    cmd.Stdin = os.Stdin
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    err := cmd.Run()
    checkErr(err)
}

func dirWalk(dir string) []string{
    fInfo, err := os.Stat(dir)
    checkErr(err)
    if !(fInfo.IsDir()){
        return []string{dir}
    }
    files, err := ioutil.ReadDir(dir)
    checkErr(err)
    var paths []string
    for _, file := range files{
        paths = append(paths, dirWalk(filepath.Join(dir, file.Name()))...)
    }
    return paths
}

func main(){
    flag.Parse()
    args := flag.Args()
    var allTempPaths = []string{}
    for _, arg := range args{
        paths, err := filepath.Glob(arg)
        checkErr(err)
        allTempPaths = append(allTempPaths, paths...)
    }
    var allPaths = []string{}
    for _, path := range allTempPaths{
        allPaths = append(allPaths, dirWalk(path)...)
    }
    filePathArr := make([]*FilePath, len(allPaths))
    NoID := len(filePathArr)
    for ind, path := range allPaths{
        filePathArr[ind] = newFilePath(path)
        fmt.Printf("\r%d/%d", ind+1, NoID)
    }
    fmt.Println("")
    files := writeFiles(filePathArr)
    tmpFiles := make([]*os.File, 2)
    var tmpFileBody string
    tmpPaths := make([]string, 2)
    var err error
    tmpFiles[0], err = ioutil.TempFile("", "vimrenameORIGINAL")
    defer tmpFiles[0].Close()
    checkErr(err)
    tmpFiles[0].WriteString(files[0])
    tmpPaths[0] = tmpFiles[0].Name()
    tmpFiles[1], err = ioutil.TempFile("", "vimrenameRENAMED")
    defer tmpFiles[1].Close()
    checkErr(err)
    tmpFiles[1].WriteString(files[1])
    tmpPaths[1] = tmpFiles[1].Name()

    openTmpFiles(tmpPaths)
    var allFileb []byte
    allFileb, err = ioutil.ReadFile(tmpPaths[1])
    checkErr(err)
    tmpFileBody = string(allFileb)
    readFile(filePathArr, tmpFileBody)
    for ind, id := range filePathArr{
        id.move()
        fmt.Printf("\033[1K\r%d/%d: %s", ind+1, NoID, id.Path)
    }
    fmt.Println("")
    for k := 0; k < 2; k++{
        os.Remove(tmpFiles[k].Name())
    }
}
