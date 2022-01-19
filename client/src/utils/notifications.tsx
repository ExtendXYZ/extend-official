import React from 'react';
import {notification} from 'antd';
import JSConfetti from 'js-confetti';

// import Link from '../components/Link';

export function notify({
  message = '',
  description = undefined as any,
  txid = '',
  type = 'info',
  duration = 5,
  placement = 'bottomLeft',
}) {
  if (txid) {
    //   <Link
    //     external
    //     to={'https://explorer.solana.com/tx/' + txid}
    //     style={{ color: '#0000ff' }}
    //   >
    //     View transaction {txid.slice(0, 8)}...{txid.slice(txid.length - 8)}
    //   </Link>

    description = <></>;
  }
  (notification as any)[type]({
    message: <span /*style={{ color: "white" }}*/>{message}</span>,
    description: (
      <span /*style={{ color: "white", opacity: 0.5 }}*/>{description}</span>
    ),
    placement,
    duration,
    /*
    style: {
      backgroundColor: boxColor,
    },*/
  });
}

export function register_succeed_notify({
  wallet,
  numSucceed,
  numRegistering,
  type = 'info',
  duration = 0,
  placement = 'bottomLeft',
}) {
  let link = `https://${window.location.host}/pubkey/${wallet.publicKey.toBase58()}`;
  let description = (<div>
    Click <a href={link} target="_blank" rel="noopener noreferrer">here</a> to go interact with them!
  </div>);

  (notification as any)[type]({
    message: <span>{`Congratulations! Register succeeded for ${numSucceed} out of ${numRegistering} spaces.`}</span>,
    description: (
      <span>{description}</span>
    ),
    placement,
    duraction: null,
  });

  const jsConfetti = new JSConfetti()

  jsConfetti.addConfetti()
}
