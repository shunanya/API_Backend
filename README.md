# API_Backend

The current project is example which is simply explain how to create various servers by using Node.js.
3 kind of servers is created simultaneous - http, ordinary https and https with client certificate.

As usually you need to start with initialization of project
```
    npm install
```
This command will download the required libraries and put them into `node_modules` folder.

Next you can generate https certificate. To do so goto `_ssh` folder
```
    cd _ssh
```
and run `./make_server_cert.sh` script.
- **Note**: the server certificate will be created according `./cnf/server.cnf` config file.

As soon as script finish with success, CA and Server certificates will be created.
Note: PFX formatted certificate will be created in parallel to PEM certificates if you allowed to build it during script running.

The client certificate can be created as well. To do so please run `make_client_cert.sh` script.
```
    ./make_client_cert.sh -c <client name>
```
After script success finishing the folder named `<client name>` will be created. 
This folder will contain the client certificates (PEM and PDF) based on configuration `./cnf/<client name>.cnf`.

That is all with certificates.

Now you can start Node.js with `server.js` or `cluster.js`.
```
    node --openssl-legacy-provider server.js

    node --openssl-legacy-provider cluster.js
```
- **Note**: the environment variable `--openssl-legacy-provider` is needed only if you generated and use PFX certificate.

The `server.js` will start only one instance of server script.

The `cluster.js` start a cluster of 2 (given in configuration `config.json`) server scripts instances. 
As soon as one instance for some reason will be down a new instance will be immediately started instead.
So you will have always 2 instances of server scripts. It is just the reason to have Node.js cluster.

As soon as server or cluster is started you can test it.

1. Put in browser `http://127.0.0.1:8081/check`. You should see answer from API like the following
```
   `07fae851f3f3467ca78ae0efdbec888b.0 {"t":"Fri, 09 Feb 2024 16:16:22 GMT","proto":"http","ip":"127.0.0.1","method":"GET","path":"/check"}`
```
2.  Put in browser `https://127.0.0.1:8443/`. You should see answer from API like the following 
```
    `07fae851f3f3467ca78ae0efdbec888b.0 {"t":"Fri, 09 Feb 2024 16:16:16 GMT","proto":"https","ip":"127.0.0.1","method":"GET","path":"/"}`
```
3. Add to Postman a new request `https://127.0.0.1:8444` 
and add certificate (PFX or PEM) from `./_ssh/<client name>` folder into `Settings->Certificates` .
Now send the request and you should see response body like ordinary HTTPS server.

4. You can REJECT the existing client request by REVOKING its certificate. 
To do so call `revoke_client_cert.sh` 
```
    revoke_client_cert.sh -c <client name>
```
So now the same request from Postman will be refused.


- **Note**: usage of PFX certificate in server sometimes does not allow to revoke the certificate in contrast of PEM certificate that is always working perfectly.
