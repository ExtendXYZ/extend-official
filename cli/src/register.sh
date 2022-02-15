set -e

while getopts k:r:e: flag
do
    case "${flag}" in
        k) KEYPAIR=${OPTARG};;
        r) R=${OPTARG};;
        e) ENV=${OPTARG};;
    esac
done

echo $KEYPAIR
npx ts-node extend-cli.ts register -k ${KEYPAIR} -l trace -r ${R} -e ${ENV}