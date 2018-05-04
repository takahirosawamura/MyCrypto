import EthTx from 'ethereumjs-tx';
import { addHexPrefix, toBuffer } from 'ethereumjs-util';
import { WalletLib } from 'shared/enclave/types';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import LedgerEth from '@ledgerhq/hw-app-eth';
let transport: any;

async function getEthApp() {
  try {
    if (!transport) {
      transport = await TransportNodeHid.create();
      transport.on('disconnect', () => (transport = null));
    }
    return new LedgerEth(transport);
  } catch (err) {
    if (err && err.message && err.message.includes('cannot open device with path')) {
      throw new Error(
        'Your Ledger is currently in use with another application. Please wait, or close other wallet applications before trying again.'
      );
    }
    throw err;
  }
}

const Ledger: WalletLib = {
  async getChainCode(dpath) {
    const app = await getEthApp();
    try {
      const res = await app.getAddress(dpath, false, true);
      return {
        publicKey: res.publicKey,
        chainCode: res.chainCode
      };
    } catch (err) {
      throw new Error('Failed to connect to Ledger');
    }
  },

  async signTransaction(tx, path) {
    const app = await getEthApp();
    const ethTx = new EthTx({
      ...tx,
      v: Buffer.from([tx.chainId]),
      r: toBuffer(0),
      s: toBuffer(0)
    });

    const rsv = await app.signTransaction(path, ethTx.serialize().toString('hex'));
    const signedTx = new EthTx({
      ...tx,
      r: addHexPrefix(rsv.r),
      s: addHexPrefix(rsv.s),
      v: addHexPrefix(rsv.v)
    });
    return {
      signedTransaction: signedTx.serialize().toString('hex')
    };
  },

  async signMessage(msg, path) {
    const app = await getEthApp();
    const msgHex = Buffer.from(msg).toString('hex');
    const signed = await app.signPersonalMessage(path, msgHex);
    const combined = addHexPrefix(signed.r + signed.s + signed.v.toString(16));
    return {
      signedMessage: combined
    };
  },

  async displayAddress(path) {
    try {
      const app = await getEthApp();
      await app.getAddress(path, true, false);
      return {
        success: true
      };
    } catch (err) {
      return {
        success: false
      };
    }
  }
};

export default Ledger;
