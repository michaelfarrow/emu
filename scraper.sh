#!/bin/bash

gr=/usr/local/go
go=$gr/bin/go
gp=/home/kiosk/go

sudo -u kiosk GOROOT=$gr GOPATH=$gp $go get github.com/sselph/scraper
sudo -u kiosk GOROOT=$gr GOPATH=$gp $go build -x -o /home/kiosk/go/bin/scraper github.com/sselph/scraper
