while getopts p: flag
do
    case "${flag}" in
        p) PROGRAM_ID=${OPTARG};;
    esac
done

echo $PROGRAM_ID
solana config set --keypair $PROGRAM_ID
PROGRAM_PUBKEY=$(solana-keygen pubkey)
solana config set --keypair usb://ledger\?key=0
solana-keygen new --force --no-bip39-passphrase --outfile ./hotwallet.json
solana config set --keypair ./hotwallet.json
HOT_PUBKEY=$(solana-keygen pubkey)
echo $HOT_PUBKEY
COLD_PUBKEY=$(solana-keygen pubkey usb://ledger\?key=0)
solana config set --keypair usb://ledger\?key=0
solana transfer $HOT_PUBKEY 10 --allow-unfunded-recipient
solana config set --keypair ./hotwallet.json
solana program deploy ./target/deploy/extend-rent.so --program-id $PROGRAM_ID
solana program set-upgrade-authority $PROGRAM_ID --new-upgrade-authority $COLD_PUBKEY
solana transfer $COLD_PUBKEY ALL
solana config set --keypair usb://ledger\?key=0
