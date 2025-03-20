const { getProxyAgent } = require("./proxy");
const UserAgent = require("user-agents");
const axios = require("axios");
const bs58 = require("bs58");
const nacl = require("tweetnacl");
const { Keypair } = require("@solana/web3.js");
const { logMessage } = require("../utils/logger");
const userAgent = new UserAgent().toString();

module.exports = class flow3Bot {
  constructor(account, proxy = null, currentNum, total) {
    this.currentNum = currentNum;
    this.total = total;
    this.token = null;
    this.proxy = proxy;
    this.wallet = this.getWalletFromPrivateKey(account);
    this.axiosConfig = {
      ...(this.proxy && { httpsAgent: getProxyAgent(this.proxy) }),
      timeout: 120000,
      headers: {
        "User-Agent": userAgent,
        Origin: "chrome-extension://lhmminnoafalclkgcbokfcngkocoffcp",
      },
    };
  }

  async makeRequest(method, url, config = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios({
          method,
          url,
          ...this.axiosConfig,
          ...config,
        });

        return response;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          logMessage(
            this.currentNum,
            this.total,
            "Unauthorized (401), trying to re-login...",
            "warning"
          );
          this.token = await this.loginUser();
          logMessage(
            this.currentNum,
            this.total,
            "Re-login successful, retrying request...",
            "process"
          );
          continue;
        }
        logMessage(
          this.currentNum,
          this.total,
          `Request Failed ${error.message}`,
          "error"
        );

        logMessage(
          this.currentNum,
          this.total,
          `Retrying... (${i + 1}/${retries})`,
          "process"
        );
        await new Promise((resolve) => setTimeout(resolve, 12000));
      }
    }
    return null;
  }

  getWalletFromPrivateKey(privateKeyBase58) {
    const secretKey = bs58.decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(secretKey);
    return keypair;
  }

  async generateSignature(message) {
    const messageBuffer = Buffer.from(message);
    const secretKey = new Uint8Array(this.wallet.secretKey);
    const signature = nacl.sign.detached(messageBuffer, secretKey);
    const encode = bs58.encode(signature);
    return encode;
  }

  async loginUser() {
    logMessage(
      this.currentNum,
      this.total,
      `Trying Login Account...`,
      "process"
    );
    const message = `Please sign this message to connect your wallet to Flow 3 and verifying your ownership only.`;
    const signature = await this.generateSignature(message);
    const payload = {
      message: message,
      walletAddress: this.wallet.publicKey.toBase58(),
      signature: signature,
    };

    try {
      const response = await this.makeRequest(
        "POST",
        "https://api.flow3.tech/api/v1/user/login",
        {
          data: payload,
        }
      );
      if (response?.data.statusCode === 200) {
        logMessage(this.currentNum, this.total, "Login Success", "success");
        this.token = response.data.data.accessToken;
        return response.data.data.accessToken;
      }
      return null;
    } catch (error) {
      logMessage(
        this.curentNum,
        this.total,
        `Login failed: ${error.message}`,
        "error"
      );
      return null;
    }
  }

  async sharingBandwith() {
    logMessage(
      this.currentNum,
      this.total,
      "Trying sharing bandwith...",
      "process"
    );
    const headers = {
      Authorization: `Bearer ${this.token}`,
    };

    try {
      const response = await this.makeRequest(
        "POST",
        "https://api.mtcadmin.click/api/v1/bandwidth",
        { headers: headers }
      );
      if (response.data.statusCode === 200) {
        logMessage(
          this.currentNum,
          this.total,
          `Success sharing bandwith`,
          "success"
        );
        return true;
      }
      return false;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Failed to sharing bandwith`,
        "error"
      );
      return false;
    }
  }

  async getPoints() {
    logMessage(
      this.currentNum,
      this.total,
      "Trying getting points...",
      "process"
    );
    const headers = {
      Authorization: `Bearer ${this.token}`,
    };

    try {
      const response = await this.makeRequest(
        "GET",
        `https://api.mtcadmin.click/api/v1/point/info`,
        {
          headers: headers,
        }
      );

      if (response.data.statusCode === 200) {
        logMessage(
          this.currentNum,
          this.total,
          `Success get points`,
          "success"
        );
        return response.data.data;
      }
      logMessage(this.currentNum, this.total, `Failed to get points`, "error");
      return null;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Failed to get points: ${error.message}`,
        "error"
      );
      return null;
    }
  }

  async processKeepAlive() {
    try {
      if (!this.token) {
        await this.loginUser();
      }

      const sharingBandwith = await this.sharingBandwith();
      const data = await this.getPoints();

      return {
        points: {
          total: data.totalEarningPoint,
          today: data.todayEarningPoint,
        },
        keepAlive: sharingBandwith,
      };
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logMessage(
          this.currentNum,
          this.total,
          "Token expired, attempting to login again...",
          "warning"
        );
        await this.loginUser();
        return this.processKeepAlive();
      }

      logMessage(
        this.currentNum,
        this.total,
        `Failed to process account: ${error.message}`,
        "error"
      );
      throw error;
    }
  }
};
