set -e

while getopts k:x:y:t:r:e: flag
do
    case "${flag}" in
        k) KEYPAIR=${OPTARG};;
        x) NX=${OPTARG};;
        y) NY=${OPTARG};;
        t) T=${OPTARG};;
        r) R=${OPTARG};;
        e) ENV=${OPTARG};;
    esac
done

echo $KEYPAIR
npx ts-node extend-cli.ts mint-tokens -k ${KEYPAIR} -l trace -nx ${NX} -ny ${NY} -t ${T} -r ${R} -e ${ENV}