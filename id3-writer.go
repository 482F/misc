package main
import (
    id3 "github.com/mikkyang/id3-go"
    "strings"
    "log"
    "flag"
    "path/filepath"
    "os"
    "io/ioutil"
    "os/exec"
)

type Id3Data struct{
    Path string
    Directory string
    Name string
    Title string
    Artist string
    Album string
    isNameEdited bool
    isTitleEdited bool
    isArtistEdited bool
    isAlbumEdited bool
}

func newId3Data(path string) *Id3Data{
    id3Data := new(Id3Data)
    id3Data.Path = path
    id3Data.Directory, id3Data.Name = filepath.Split(id3Data.Path)
    id3Data.readFile()
    id3Data.isNameEdited = false
    id3Data.isTitleEdited = false
    id3Data.isArtistEdited = false
    id3Data.isAlbumEdited = false
    return id3Data
}

func (id *Id3Data) setName(name string){
    id.Name = name
    id.isNameEdited = true
}

func (id *Id3Data) setTitle(title string){
    id.Title = title
    id.isTitleEdited = true
}

func (id *Id3Data) setArtist(artist string){
    id.Artist = artist
    id.isArtistEdited = true
}

func (id *Id3Data) setAlbum(album string){
    id.Album = album
    id.isAlbumEdited = true
}

func (id *Id3Data) readFile(){
    mp3File, err := id3.Open(id.Path)
    defer mp3File.Close()
    checkErr(err)
    id.Title = mp3File.Title()
    id.Artist = mp3File.Artist()
    id.Album = mp3File.Album()
}

func (id *Id3Data) writeFile(){
    mp3File, err := id3.Open(id.Path)
    defer mp3File.Close()
    checkErr(err)
    if id.isNameEdited{
        err = os.Rename(id.Path, id.Directory + id.Name)
    }
    checkErr(err)
    if id.isTitleEdited{
        mp3File.SetTitle(id.Title)
    }
    if id.isArtistEdited{
        mp3File.SetArtist(id.Artist)
    }
    if id.isAlbumEdited{
        mp3File.SetAlbum(id.Album)
    }
}

func (id *Id3Data) writeArr() []string{
    return []string{id.Name, id.Title, id.Artist, id.Album}
}

func (id *Id3Data) readArr(arr []string) {
    if (arr[0] == ""){
        return
    }
    if (id.Name != arr[0] + ".mp3"){
        id.setName(arr[0] + ".mp3")
    }
    if (arr[1] == ""){
        arr[1] = arr[0]
    }
    if (id.Title != arr[1]){
        id.setTitle(arr[1])
    }
    if (id.Artist != arr[2]){
        id.setArtist(arr[2])
    }
    if (id.Album != arr[3]){
        id.setAlbum(arr[3])
    }
}

func writeFiles(ids []*Id3Data) []string{
    files := []string{"", "", "", ""}
    for _, id := range ids{
        files[0] += id.Name[:len(id.Name)-4] + "\n"
        files[1] += id.Title + "\n"
        files[2] += id.Artist + "\n"
        files[3] += id.Album + "\n"
    }
    return files
}

func readFiles(ids []*Id3Data, files []string){
    filess := make([][]string, 4)
    for k := 0; k < 4; k++{
        filess[k] = strings.Split(files[k] + strings.Repeat("\n", len(ids)), "\n")
    }
    for ind, id := range ids{
        id.readArr([]string{filess[0][ind], filess[1][ind], filess[2][ind], filess[3][ind]})
    }
}

func checkErr(err error){
    if err != nil{
        log.Fatal(err)
    }
}

func openTmpFiles(paths []string){
    cmd := exec.Command("vim", "-c", "set scb", "-c", "normal ", "-c", "set scb", "-c", "normal ", "-c", "set scb", "-c", "normal ", "-c", "set scb", "-c", "normal ", "-O", paths[0], paths[1], paths[2], paths[3])
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
        if file.IsDir(){
            paths = append(paths, dirWalk(filepath.Join(dir, file.Name()))...)
            continue
        }
        paths = append(paths, filepath.Join(dir, file.Name()))
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
    id3DataArr := make([]*Id3Data, len(allPaths))
    for ind, path := range allPaths{
        id3DataArr[ind] = newId3Data(path)
    }
    files := writeFiles(id3DataArr)
    tmpFiles := make([]*os.File, 4)
    tmpFileBodies := make([]string, 4)
    tmpPaths := make([]string, 4)
    var err error
    for k := 0; k < 4; k++{
        tmpFiles[k], err = ioutil.TempFile("", "id3-writer")
        defer tmpFiles[k].Close()
        defer os.Remove(tmpFiles[k].Name())
        checkErr(err)
        tmpFiles[k].WriteString(files[k])
        tmpPaths[k] = tmpFiles[k].Name()
    }
    openTmpFiles(tmpPaths)
    var allFileb []byte
    for k := 0; k < 4; k++{
        allFileb, err = ioutil.ReadFile(tmpPaths[k])
        checkErr(err)
        tmpFileBodies[k] = string(allFileb)
    }
    readFiles(id3DataArr, tmpFileBodies)
    for _, id := range id3DataArr{
        id.writeFile()
    }
}
