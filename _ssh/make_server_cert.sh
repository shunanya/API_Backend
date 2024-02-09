#!/bin/bash

declare -r server="server"
declare -r ca="ca"
declare -r cnf="cnf"
declare -r temp="temp"
passwd=""

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
cur_path=` pwd `


cnf_path="$tmp/$cnf"
if [[ (-d "$cnf_path") && (-f "$cnf_path/$ca.cnf") && (-f "$cnf_path/$server.cnf") ]] ; then
  echo "$cnf_path is complete"
else
  echo "$cnf_path isn't complete"
  echo "OpenSSH configuration for Certificate Authority (CA) and Server parts have to be there."
  exit 1
fi

echo "WARNING: whole $tmp folder will be cleaned (excluding ./cnf folder)."
read -p "Do you agree to continue? (y/n)" continue
if [[ ( "$continue" != "y" ) && ( "$continue" != "Y" ) ]] ; then
    echo "Processing will not be continued."
    exit 0
fi

ls | grep -v '\(cnf\|.*.sh\)' | xargs rm -f -r

temp_path="$tmp/$temp"
rm -f -R $temp_path
mkdir -p $temp_path

server_path="$tmp/$server"
rm -f -r $server_path
mkdir -p $server_path

ca_path="$tmp/$ca"
rm -f -r $ca_path
mkdir -p $ca_path

echo
echo '>>> Make Server Certificates <<<'
while  [ ${#passwd} -lt 8 ] ; 
 do
    echo "Please enter your password (length should be more or equal 8 chars)"
    read -s passwd
 done

echo "password = "$passwd

cd "$temp_path"

# Make Server Certificates
ret=0
touch ca-database.txt
openssl req -new -x509 -days 9999 -config "$cnf_path/ca.cnf" -keyout ca.key -out ca.crt -passin pass:"$passwd" -passout pass:"$passwd"
r=$?
ret=$((ret+r))

openssl genrsa -passout pass:$passwd -out server.key 4096
r=$?
ret=$((ret+r))

openssl req -new -passin pass:$passwd -passout pass:$passwd -config "$cnf_path/server.cnf" -key server.key -out server.csr
r=$?
ret=$((ret+r))

openssl x509 -req -extfile "$cnf_path/server.cnf" -days 999 -passin pass:"$passwd" -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
r=$?
ret=$((ret+r))

openssl ca -passin pass:"$passwd" -keyfile ca.key -cert ca.crt -config "$cnf_path/ca.cnf" -gencrl -out ca.crl
r=$?
ret=$((ret+r))

if [[ ($ret -ne 0) ]] ; then
    echo '!!! WRONG Occured !!!'
    echo '!!! processing will be stopped !!!'
    exit $return
fi

echo
echo "You can also add a certificate in PFX format."
read -p "Do you agree to continue? (y/n)" continue
if [[ ( "$continue" = "y" ) || ( "$continue" = "Y" ) ]] ; then
    echo
    echo '>>> Creating server.pfx <<<'

    pfxpswd=""

    while  [ ${#pfxpswd} -lt 8 ] ; 
    do
        echo "Please enter PFX encryption password (length should be more or equal 8 chars)"
        read -s pfxpswd
    done

    echo "password = "$pfxpswd

    openssl pkcs12 -export -out server.pfx -inkey server.key -in server.crt -certfile ca.crt -passin pass:$passwd -passout pass:$pfxpswd
    r=$?
    ret=$((ret+r))

    if [[ ($ret -ne 0) ]] ; then
        echo '!!! WRONG occured !!!'
        echp '!!! processing will be stopped !!!'
        exit $return
    fi

    echo
    echo '>>> Verifying server.pfx <<<'

    openssl pkcs12 -in server.pfx -passin pass:$pfxpswd -passout pass:$passwd -info

    echo PFX certificate is valid `openssl pkcs12 -in server.pfx -passin pass:$pfxpswd -nokeys | openssl x509 -noout -enddate`
fi

echo '>>> Copying to' $server_path '<<<'

cp $ca*.* $ca_path
cp $server.* $server_path
cp $ca.* $server_path

ls -la $server_path

cd "$cur_path"
