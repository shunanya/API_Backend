#!/bin/bash

declare -r ca="ca"
declare -r cnf="cnf"
declare -r server="server"
declare -r temp="temp"

client=""
passwd=""
#read arguments
while getopts ":c:p:h" opt;
do
        case $opt in
        h) echo " make_client_cert.sh -c <client name to be certificates generated for> "
            exit 0 ;;
        c) client="$OPTARG"
        	echo "client for certificates generation = $client" ;;
        p) passwd="$OPTARG"
		echo "password for certificates generation = $passwd" ;;
#        *) echo "Unknown parameter ignored" ;;
        esac
done

if [[ ("x$client" == "x") || ($client == $ca) && ($client == $server) ]] ; then
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
if [[ (-d "$cnf_path") && (-f "$cnf_path/$ca.cnf") && (-f "$cnf_path/client_template.cnf") ]] ; then
  echo "$cnf_path is complete"
else
  echo "ERROR: $cnf_path is incomplete"
  exit 1
fi

cd "$cnf_path"
if [[ (-f $client.cnf ) ]] ; then
    echo "Warning: File $client.cnf already exist"
    read -p "Do you agree to regenarate it with new one? (y/n)" continue
    if [[ ( "$continue" != "y" ) && ( "$continue" != "Y" ) ]] ; then
        echo "Processing will not be continued."
        exit 0
    fi
fi

rm $client.cnf
echo "Creating..."
sed -e "s/CLIENT_NAME/$client/" client_template.cnf > $client.cnf

client_path="$tmp/$client"
rm -f -r $client_path
mkdir -p $client_path

cd "$temp_path"

rm -f $client.*

# Client1 Certificates
echo
echo '>>> Make Client1 Certificates <<<'
while  [ ${#passwd} -lt 8 ] ; 
 do
    echo "Please enter client correct password (length shouldn't be less than 8 chars)"
    read -s passwd
 done  


ret=0
openssl genrsa -out $client.key 4096
r=$?
ret=$((ret+r))
openssl req -new -config "$cnf_path/$client.cnf" -key $client.key -out $client.csr
r=$?
ret=$((ret+r))
openssl x509 -req -extfile "$cnf_path/$client.cnf" -days 999 -passin pass:$passwd -in $client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out $client.crt
r=$?
ret=$((ret+r))
openssl verify -CAfile ca.crt $client.crt
r=$?
ret=$((ret+r))

if [[ ($ret -ne 0) ]] ; then
    echo '!!! WRONG occured !!!'
    echo '!!! processing will be stopped !!!'
    exit $return
fi

echo
echo "You can also add a certificate in PFX format."
read -p "Do you agree to continue? (y/n)" continue
if [[ ( "$continue" = "y" ) || ( "$continue" = "Y" ) ]] ; then
    echo
    echo '>>> Creating client pfx certificate <<<'

    pfxpswd=""

    while  [ ${#pfxpswd} -lt 8 ] ; 
    do
        echo "Please enter PFX encryption password (length should be more or equal 8 chars)"
        read -s pfxpswd
    done

    echo "password = "$pfxpswd

    openssl pkcs12 -export -out $client.pfx -inkey $client.key -in $client.crt -certfile ca.crt -passin pass:$passwd -passout pass:$pfxpswd
    r=$?
    ret=$((ret+r))


    if [[ ($ret -ne 0) ]] ; then
        echo '!!! WRONG occured !!!'
        echo '!!! processing will be stopped !!!'
        exit $return
    fi

    echo PFX certificate is valid `openssl pkcs12 -in $client.pfx -passin pass:$pfxpswd -nokeys | openssl x509 -noout -enddate`
fi

echo
echo "Client \"$client\" certificates were created succesfully"

echo '>>> Copying to' $client_path '<<<'

cp $client.* $client_path
cp "$ca.crt" "$client_path"
ls -la $client_path

cd $cur_path


