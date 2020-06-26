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

func (id *Id3Data) writeTSV() string{
    return id.Name[:len(id.Name)-4] + "\t" + id.Title + "\t" + id.Artist + "\t" + id.Album
}

func (id *Id3Data) readTSV(TSV string) {
    slice := strings.Split(TSV, "\t")
    l := len(slice)
    if (l <= 0){
        return
    }
    if (id.Name != slice[0] + ".mp3"){
        id.setName(slice[0] + ".mp3")
    }
    if (l <= 1){
        return
    }
    if (slice[1] == ""){
        slice[1] = slice[0]
    }
    if (id.Title != slice[1]){
        id.setTitle(slice[1])
    }
    if (l <= 2){
        return
    }
    if (id.Artist != slice[2]){
        id.setArtist(slice[2])
    }
    if (l <= 3){
        return
    }
    if (id.Album != slice[3]){
        id.setAlbum(slice[3])
    }
}

func writeTSVs(ids []*Id3Data) []string{
    TSVs := make([]string, len(ids))
    for ind, id := range ids{
        TSVs[ind] = id.writeTSV()
    }
    return TSVs
}

func readTSVs(ids []*Id3Data, TSVs []string){
    for ind, id := range ids{
        id.readTSV(TSVs[ind])
    }
}

func checkErr(err error){
    if err != nil{
        log.Fatal(err)
    }
}

func runVim(path string){
    cmd := exec.Command("vim", path)
    cmd.Stdin = os.Stdin
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    err := cmd.Run()
    checkErr(err)
}

func main(){
    flag.Parse()
    args := flag.Args()
    var allPaths = []string{}
    for _, arg := range args{
        paths, err := filepath.Glob(arg)
        checkErr(err)
        allPaths = append(allPaths, paths...)
    }
    id3DataArr := make([]*Id3Data, len(allPaths))
    for ind, path := range allPaths{
        id3DataArr[ind] = newId3Data(path)
    }
    TSVs := writeTSVs(id3DataArr)
    allTSV := strings.Join(TSVs, "\n")
    tmpFile, err := ioutil.TempFile("", "id3-writer")
    defer tmpFile.Close()
    defer os.Remove(tmpFile.Name())
    checkErr(err)
    tmpFile.WriteString(allTSV)
    runVim(tmpFile.Name())
    allTSVb, err := ioutil.ReadFile(tmpFile.Name())
    allTSV = string(allTSVb)
    checkErr(err)
    TSVs = strings.Split(allTSV, "\n")
    readTSVs(id3DataArr, TSVs)
    for _, id := range id3DataArr{
        id.writeFile()
    }
}
