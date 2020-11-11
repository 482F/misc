package main

import (
    "fmt"
    "os/exec"
)

func main(){
    err := exec.Command("cmd", "/c start target.lnk").Start()
    if err != nil{
        fmt.Println(err.Error())
    }
    return
}
