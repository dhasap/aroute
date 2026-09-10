docker stop aroute
docker rm aroute
docker build -t aroute .
docker run -d --name aroute -p 20128:20128 --env-file .env -v aroute-data:/app/data aroute