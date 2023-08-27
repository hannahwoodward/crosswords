# Crosswords

Javascript tool to download and export Private Eye cryptic crosswords to pdf.


## Useful links

* [Docker build help](https://docs.docker.com/engine/reference/commandline/build/)
* [Docker run help](https://docs.docker.com/engine/reference/commandline/run/)


## Installation & use

* [Install Docker desktop](https://www.docker.com/get-started)
* Ensure Docker desktop is running
* Clone repo & navigate inside:

```
git clone git@github.com:hannahwoodward/crosswords.git && cd crosswords
```

* Build Docker image:

```
docker build -t crosswords .
```

* Run locally built image, mounting local working directory to container directory `/home/node`:

```
docker run -it --rm --volume=${PWD}:/home/node crosswords
```

* In container shell, run script for help:

```
node index.js
```


## Examples

* Download and export Private Eye cryptic crossword #500:

```
node index.js privateEye 500
```

* Download and export Private Eye cryptic crosswords #500-#510:

```
node index.js privateEye 500 510
```
