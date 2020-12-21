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
    assignMap map[string]*FilePath
    originalPath string
    Path string
    Directory string
    Name string
    isEdited bool
    isMoving bool
}

func newFilePath(assignMap map[string]*FilePath, path string) *FilePath{
    filePath := new(FilePath)
    filePath.assignMap = assignMap
    filePath.Path = path
    filePath.originalPath = path
    _, filePath.Directory, filePath.Name, _, _ = splitFileName(path)
    filePath.isEdited = false
    filePath.isMoving = false
    return filePath
}

func (fp *FilePath) isCollide() (bool, *FilePath){
    cfp, ic := fp.assignMap[fp.Path]
    return ic, cfp
}

func (fp *FilePath) setName(name string){
    fp.Name = name
    fp.Path = fp.Directory + fp.Name
    fp.assignMap[fp.originalPath] = fp
    fp.isEdited = true
}

func (fp *FilePath) isAlreadyExist() bool{
    return isAlreadyExist(fp.Path)
}

func (fp *FilePath) makeAltPath() string{
    if !isAlreadyExist(fp.Path){
        return fp.Path
    }
    var index int = 1
    var altPath string
    var pathWithoutExt, ext string
    pathWithoutExt, _, _, _, ext = splitFileName(fp.Path)
    for{
        altPath = fmt.Sprintf(pathWithoutExt + "_%d" + ext, index)
        if !isAlreadyExist(altPath){
            return altPath
        }
        index += 1
    }
}

func (fp *FilePath) move(){
    fp.isMoving = true
    if fp.isEdited{
        if f, cfp := fp.isCollide(); f{
            if cfp.isMoving{
                var altPath string = cfp.makeAltPath()
                var originalTarget string = cfp.Path
                cfp.Path = altPath
                cfp.move()
                cfp.isMoving = true
                cfp.originalPath = altPath
                cfp.Path = originalTarget
            }else{
                cfp.move()
            }
        }
        if fp.isAlreadyExist(){
            fp.Path = fp.makeAltPath()
        }
        err := os.Rename(fp.originalPath, fp.Path)
        checkErr(err)
        fp.originalPath = fp.Path
    }
    fp.isMoving = false
    fp.isEdited = false
    fp.originalPath = fp.Path
}

func (fp *FilePath) readArr(newName string) {
    if (newName == ""){
        return
    }
    if (fp.Name != newName){
        fp.setName(newName)
    }
}

func isAlreadyExist(path string) bool{
    _, err := os.Stat(path)
    return err == nil
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

func splitFileName(path string) (string, string, string, string, string){
    var pathWithoutExt, directory, name, nameWithoutExt, ext string
    directory, name = filepath.Split(path)
    ext = filepath.Ext(name)
    nameWithoutExt = name[:len(name)-len(filepath.Ext(name))]
    pathWithoutExt = directory + nameWithoutExt
    return pathWithoutExt, directory, name, nameWithoutExt, ext
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
    var assignMap map[string]*FilePath = make(map[string]*FilePath)
    for ind, path := range allPaths{
        filePathArr[ind] = newFilePath(assignMap, path)
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
