import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
  Field,
  Poseidon,
} from 'snarkyjs';

import { Executor } from './executor';

await isReady;
await Executor.compile();

describe('executor', () => {
  let executorPrivateKey: PrivateKey;
  let executorAddress: PublicKey;

  let deployerPrivateKey: PrivateKey;
  let player1PrivateKey: PrivateKey;

  beforeEach(async () => {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    executorPrivateKey = PrivateKey.random();
    executorAddress = executorPrivateKey.toPublicKey();

    deployerPrivateKey = Local.testAccounts[0].privateKey;
    player1PrivateKey = Local.testAccounts[1].privateKey;
  });

  afterAll(async () => {
    setTimeout(shutdown, 0);
  });

  describe('deposit', () => {
    it('sets initial balance', async () => {
      // setup
      const merkleMap = new MerkleMap();
      const key = Poseidon.hash(player1PrivateKey.toPublicKey().toFields());
      const witness = merkleMap.getWitness(key);
      const executor = new Executor(executorAddress);

      const tx = await Mina.transaction(deployerPrivateKey, () => {
        AccountUpdate.fundNewAccount(deployerPrivateKey);
        executor.deploy({ zkappKey: executorPrivateKey });
        executor.init();
      });
      await tx.send();

      const tx2 = await Mina.transaction(player1PrivateKey, () => {
        executor.deposit(
          player1PrivateKey.toPublicKey(),
          Field(1000),
          Field(0),
          witness
        );
      });
      await tx2.prove();
      tx2.sign([player1PrivateKey]);
      await tx2.send();

      // test
      const appState = Mina.getAccount(executorAddress).appState;
      expect(appState).not.toBeNull();

      if (appState) {
        merkleMap.set(key, Field(1000));
        expect(merkleMap.getRoot().toString()).toBe(appState[0].toString());
      } else {
        throw new Error('Should not reach this');
      }
    });

    it('increases existing balance', async () => {
      // setup
      const merkleMap = new MerkleMap();
      const key = Poseidon.hash(player1PrivateKey.toPublicKey().toFields());
      const witness = merkleMap.getWitness(key);
      const executor = new Executor(executorAddress);

      const tx = await Mina.transaction(deployerPrivateKey, () => {
        AccountUpdate.fundNewAccount(deployerPrivateKey);
        executor.deploy({ zkappKey: executorPrivateKey });
        executor.init();
      });
      await tx.send();

      const tx2 = await Mina.transaction(deployerPrivateKey, () => {
        executor.deposit(
          player1PrivateKey.toPublicKey(),
          Field(1000),
          Field(0),
          witness
        );
      });
      await tx2.prove();
      tx2.sign([player1PrivateKey]);
      await tx2.send();

      merkleMap.set(key, Field(1000));

      const tx3 = await Mina.transaction(deployerPrivateKey, () => {
        executor.deposit(
          player1PrivateKey.toPublicKey(),
          Field(50),
          Field(1000),
          witness
        );
      });
      await tx3.prove();
      tx3.sign([player1PrivateKey]);
      await tx3.send();

      // test
      const appState = Mina.getAccount(executorAddress).appState;
      expect(appState).not.toBeNull();

      if (appState) {
        merkleMap.set(key, Field(1050));
        expect(merkleMap.getRoot().toString()).toBe(appState[0].toString());
      } else {
        throw new Error('Should not reach this');
      }
    });

    // it('cannot handle multiple updates within the same block', async () => {
    //   // setup
    //   const merkleMap = new MerkleMap();
    //   const key1 = Poseidon.hash(player1PrivateKey.toPublicKey().toFields());
    //   const key2 = Poseidon.hash(player2PrivateKey.toPublicKey().toFields());
    //   const witness1 = merkleMap.getWitness(key1);
    //   const witness2 = merkleMap.getWitness(key2);
    //   const executor = new Executor(executorAddress);

    //   const tx = await Mina.transaction(deployerPrivateKey, () => {
    //     AccountUpdate.fundNewAccount(deployerPrivateKey);
    //     executor.deploy({ zkappKey: executorPrivateKey });
    //     executor.init();
    //   });
    //   await tx.send();

    //   // test
    //   await expect(async () => {
    //     const tx2 = await Mina.transaction(deployerPrivateKey, () => {
    //       executor.deposit(player1PrivateKey.toPublicKey(), Field(1000), Field(0), witness1)
    //       executor.deposit(player2PrivateKey.toPublicKey(), Field(500), Field(0), witness2)
    //     });
    //     await tx2.prove();
    //     tx2.sign([player1PrivateKey, player2PrivateKey]);
    //     await tx2.send();
    //   }).toThrow();
    // });
  });
});
