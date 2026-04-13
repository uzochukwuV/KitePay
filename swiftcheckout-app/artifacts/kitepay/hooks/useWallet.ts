import "react-native-get-random-values";
import "@ethersproject/shims";
import { ethers } from "ethers";
import * as SecureStore from "expo-secure-store";
import { useState, useEffect, useCallback } from "react";

const WALLET_KEY = "kitepay_wallet_private_key";

export function useWallet() {
  const [wallet, setWallet] = useState<ethers.Wallet | ethers.HDNodeWallet | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      const privateKey = await SecureStore.getItemAsync(WALLET_KEY);
      if (privateKey) {
        const w = new ethers.Wallet(privateKey);
        setWallet(w);
      }
    } catch (e) {
      console.error("Failed to load wallet", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const createWallet = useCallback(async () => {
    try {
      setLoading(true);
      const w = ethers.Wallet.createRandom();
      await SecureStore.setItemAsync(WALLET_KEY, w.privateKey);
      setWallet(w);
      return w;
    } catch (e) {
      console.error("Failed to create wallet", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const importWallet = useCallback(async (privateKey: string) => {
    try {
      setLoading(true);
      const w = new ethers.Wallet(privateKey);
      await SecureStore.setItemAsync(WALLET_KEY, w.privateKey);
      setWallet(w);
      return w;
    } catch (e) {
      console.error("Failed to import wallet", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearWallet = useCallback(async () => {
    try {
      setLoading(true);
      await SecureStore.deleteItemAsync(WALLET_KEY);
      setWallet(null);
    } catch (e) {
      console.error("Failed to clear wallet", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  return {
    wallet,
    loading,
    createWallet,
    importWallet,
    clearWallet,
    address: wallet?.address,
  };
}
