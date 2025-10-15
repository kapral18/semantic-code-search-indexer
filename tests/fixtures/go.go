package main

import "fmt"

// Hello is a function that prints a greeting.
func Hello() {
	fmt.Println("Hello, Go!")
}

type MyType struct {
    name string
}

const MyConst = 42

func privateFunc() {
	fmt.Println("private")
}
