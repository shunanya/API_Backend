#!/bin/bash

declare -r ca="ca"
declare -r cnf="cnf"
declare -r server="server"
declare -r temp="temp"

client=""
passwd=""
delete=0
#read argument
while getopts ":c:p:dh" opt;
do
        case $opt in
        h) echo " $0 -c <client name to be revoked> "
            exit 0 ;;
        c) client="$OPTARG"
        	echo "client for revoke = $client" ;;
        d) delete=1
		echo "client should be deleted after revoking" ;;
        p) passwd="$OPTARG"
		echo "password for certificates generation = $passwd" ;;
#        *) echo "Unknown parameter ignored" ;;
        esac
done

if [[ ("x$client" == "x") ]] ; then
    echo "Client name have to be correctly defined."
    exit 1
fi

# Function returns the full path to the current script.
currentscriptpath()
{
  local fullpath=`echo "$(readlink -f $0)"`
  local fullpath_length=`echo ${#fullpath}`
  local scriptname="$(basename $0)"
  local scriptname_length=`echo ${#scriptname}`
  local result_length="$(($fullpath_length - $scriptname_length - 1))"
  local result=`echo $fullpath | head -c $result_length`
  echo $result
}

tmp=`currentscriptpath`
cd "$tmp"

cur_path=` pwd `

temp_path="$tmp/$temp"
if [[ (-d "$temp_path") && (-f "$temp_path/$ca.crt") && (-f "$temp_path/$ca.key") ]] ; then
  echo "$temp_path is complete"
else
  echo "ERROR: $temp_path is incomplete"
  exit 1
fi

cnf_path="$tmp/$cnf"
if [[ (-d "$cnf_path") && (-f "$cnf_path/$ca.cnf") && (-f "$cnf_path/$client.cnf") ]] ; then
  echo "$cnf_path is complete"
else
  echo "ERROR: $cnf_path is incomplete"
  exit 1
fi

server_path="$tmp/$server"
if [[ (-d "$server_path") && (-f "$server_path/$server.crt") ]] ; then
  echo "$server_path is complete"
else
  echo "ERROR: $server_path isn't complete"
  exit 1
fi

if [[ !(-f "$temp_path/$client.crt") || !(-f "$temp_path/$client.csr") || !(-f "$temp_path/$client.key") ]] ; then
  echo "ERROR: $client isn't exist"
  rm -f "$temp_path/$client.*"
  exit 1
fi

ca_path="$tmp/$ca"
if [[ !(-d "$ca_path") ]] ; then
  echo "WARN: $ca_path isn't exist."
fi

while  [ ${#passwd} -lt 8 ] ; 
 do
    echo "Please enter client correct password (length shouldn't be less than 8 chars)"
    read -s passwd
 done  

cd "$temp_path"
touch ca-database.txt
openssl ca -revoke "$client.crt" -keyfile ca.key -config "$cnf_path/$ca.cnf" -cert ca.crt -passin pass:$passwd
if [[ ("$?" -ne 0) ]] ; then
  echo "!!! Error occurred - cannot continue !!!"
  exit 1
fi
openssl ca -passin pass:$passwd -keyfile ca.key -cert ca.crt -config "$cnf_path/$ca.cnf" -gencrl -out ca.crl

client_path="$tmp/$client"
# Removing $client_path
rm -f -r $client_path
# Removing "$cnf_path/$client"
rm -f $cnf_path/$client.cnf

if [[ ($delete -eq 0) ]] ; then # create client
  mkdir -p $client_path
  # put into client path
  cp ca.crt "$client_path"
  cp $client.* "$client_path"
else
  rm -f $temp_path/$client.*
fi

if [[ -f "$temp_path/server.pfx" ]] ; then
    echo
    echo '>>> Recreating server.pfx <<<'

    pfxpswd=""

    while  [ ${#pfxpswd} -lt 8 ] ; 
    do
        echo "Please enter PFX encryption password (length should be more or equal 8 chars)"
        read -s pfxpswd
    done

    echo "password = "$pfxpswd

    openssl pkcs12 -export -out server.pfx -inkey server.key -in server.crt -certfile ca.crt -passin pass:$passwd -passout pass:$pfxpswd

fi

# put into ca path
cp -f ca*.* $ca_path

# put into server path
cp -f server.* $server_path
# cp -f ca.crt $server_path
# cp -f ca.crl $server_path
cp -f $ca.* $server_path

echo "Client $client was revoked"
echo "NOTE: Don't forget to restart server to be get effect of this changes"
