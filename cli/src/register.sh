set -e

while getopts k:e: flag
do
    case "${flag}" in
        k) KEYPAIR=${OPTARG};;
        e) ENV=${OPTARG};;
    esac
done

echo $KEYPAIR
npx ts-node extend-cli.ts register -k ${KEYPAIR} -l trace -e ${ENV}