const flow3Bot = require("./main/flow3bot");
const chalk = require("chalk");
const { getRandomProxy, loadProxies } = require("./main/proxy");
const fs = require("fs");
const { logMessage } = require("./utils/logger");

async function main() {
  console.log(
    chalk.cyan(`
░█▀▀░█░░░█▀█░█░█░▀▀█
░█▀▀░█░░░█░█░█▄█░░▀▄
░▀░░░▀▀▀░▀▀▀░▀░▀░▀▀░
    By : El Puqus Airdrop
    github.com/ahlulmukh
 Use it at your own risk
  `)
  );

  try {
    const accounts = fs
      .readFileSync("accounts.txt", "utf8")
      .split("\n")
      .map((account) => account.trim())
      .filter(Boolean);
    const count = accounts.length;
    const proxiesLoaded = loadProxies();
    if (!proxiesLoaded) {
      logMessage(
        null,
        null,
        "Failed to load proxies, using default IP",
        "error"
      );
    }

    const botInstances = await Promise.all(
      accounts.map(async (account, index) => {
        const currentProxy = await getRandomProxy();
        return new flow3Bot(account, currentProxy, index + 1, count);
      })
    );

    while (true) {
      logMessage(null, null, "Starting new process, Please wait...", "process");

      try {
        const results = await Promise.all(
          botInstances.map(async (flow) => {
            try {
              console.log(chalk.white("-".repeat(85)));
              const data = await flow.processKeepAlive();
              return {
                points: {
                  total: data.points.total || 0,
                  today: data.points.today || 0,
                },
                keepAlive: data.keepAlive || false,
                proxy: flow.proxy || "N/A",
              };
            } catch (error) {
              logMessage(
                null,
                null,
                `Failed to process account: ${error.message}`,
                "error"
              );
              return {
                points: {
                  total: 0,
                  today: 0,
                },
                keepAlive: false,
                proxy: "N/A",
              };
            }
          })
        );

        console.log("\n" + "═".repeat(70));
        results.forEach((result) => {
          logMessage(
            null,
            null,
            `Today Points: ${result.points.today}`,
            "success"
          );
          logMessage(
            null,
            null,
            `Total Points: ${result.points.total}`,
            "success"
          );
          const keepAliveStatus = result.keepAlive
            ? chalk.green("✔ Sharing Bandwith Success")
            : chalk.red("✖ Sharing Bandwith Failed");
          logMessage(
            null,
            null,
            `Sharing Bandwith: ${keepAliveStatus}`,
            "success"
          );
          logMessage(null, null, `Proxy: ${result.proxy}`, "success");
          console.log("─".repeat(70));
        });

        logMessage(
          null,
          null,
          "Process completed, waiting for 1 minutes before starting new sharing bandwith",
          "success"
        );

        await new Promise((resolve) => setTimeout(resolve, 60000));
      } catch (error) {
        logMessage(
          null,
          null,
          `Main process failed: ${error.message}`,
          "error"
        );
      }
    }
  } catch (error) {
    logMessage(null, null, `Main process failed: ${error.message}`, "error");
  }
}

main();
