import figlet from 'figlet';
import fs from 'fs/promises';
import { createInterface } from 'readline/promises';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ethers } from 'ethers';
import randomUseragent from 'random-useragent';
import ora from 'ora';
import chalk from 'chalk';
import schedule from 'node-schedule';
import moment from 'moment-timezone';

function getTimestamp() {
  return moment().tz('Asia/Jakarta').format('D/M/YYYY, HH:mm:ss');
}

function displayBanner() {
  const width = process.stdout.columns || 80;
  const banner = figlet.textSync('\n ADB NODE', { font: "ANSI Shadow", horizontalLayout: 'Speed' });
  banner.split('\n').forEach(line => {
    console.log(chalk.blue(line.padStart(line.length + Math.floor((width - line.length) / 2))));
  });
  console.log(chalk.green(' '.repeat((width - 28) / 2) + 'ENSO AUTO BOT !!'));
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptUser(question) {
  const answer = await rl.question(chalk.white(question));
  return answer.trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(text, color, noType = false) {
  const maxLength = 80;
  const displayText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  if (noType) {
    console.log(color(` ┊ │ ${displayText}`));
    return;
  }
  const totalTime = 200;
  const sleepTime = displayText.length > 0 ? totalTime / displayText.length : 1;
  console.log(color(' ┊ ┌── Response Chat API ──'));
  process.stdout.write(color(' ┊ │ '));
  for (const char of displayText) {
    process.stdout.write(char);
    await sleep(sleepTime);
  }
  process.stdout.write('\n');
  console.log(color(' ┊ └──'));
}

function createProgressBar(current, total) {
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  return `[${'█'.repeat(filled)}${' '.repeat(barLength - filled)} ${current}/${total}]`;
}

function displayHeader(text, color) {
  console.log(color(text));
}

function isValidPrivateKey(pk) {
  return /^0x[a-fA-F0-9]{64}$|^[a-fA-F0-9]{64}$/.test(pk);
}

function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

async function getPublicIP(proxy = null) {
  const spinner = ora({ text: chalk.cyan(' ┊ → Obtaining IP...'), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = {};
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.get('https://api.ipify.org?format=json', config);
    spinner.succeed(chalk.green(` ┊ ✓ IP: ${response.data.ip}${proxy ? ` (Proxy: ${proxy})` : ''}`));
    await sleep(100);
    return response.data.ip;
  } catch (err) {
    spinner.fail(chalk.red(' ┊ ✗ Failed to obtain IP'));
    return 'Unknown';
  }
}

async function getNonce(proxy = null, retryCount = 0) {
  const maxRetries = 5;
  const spinner = ora({ text: chalk.c?action(` ┊ → Fetching nonce${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = { headers: { 'Content-Type': 'application/json' } };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.get('https://enso.brianknows.org/api/auth/nonce', config);
    spinner.succeed(chalk.green(' ┊ ✓ Nonce received'));
    await sleep(100);
    return response.data;
  } catch (err) {
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Fetching nonce (Retry ${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return getNonce(proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Failed to fetch nonce: ${err.message}`));
    throw err;
  }
}

async function signMessage(privateKey, nonce, address) {
  const spinner = ora({ text: chalk.cyan(' ┊ → Signing message...'), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    const wallet = new ethers.Wallet(privateKey);
    const domain = 'enso.brianknows.org';
    const issuedAt = moment().toISOString();
    const message = [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      '',
      'By signing this message, you confirm you have read and accepted the following Terms and Conditions: https://terms.enso.build/',
      '',
      `URI: https://enso.brianknows.org`,
      `Version: 1`,
      `Chain ID: 56`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
    ].join('\n');

    const signature = await wallet.signMessage(message);
    const messageObj = {
      domain,
      address,
      statement: 'By signing this message, you confirm you have read and accepted the following Terms and Conditions: https://terms.enso.build/',
      uri: 'https://enso.brianknows.org',
      version: '1',
      nonce,
      issuedAt,
      chainId: 56,
    };
    spinner.succeed(chalk.green(' ┊ ✓ Message signed'));
    await sleep(100);
    return { message: messageObj, signature };
  } catch (err) {
    spinner.fail(chalk.red(` ┊ ✗ Failed to sign: ${err.message}`));
    throw err;
  }
}

async function verify(message, signature, address, proxy = null, retryCount = 0) {
  const maxRetries = 5;
  const spinner = ora({ text: chalk.cyan(` ┊ → Verifying account${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': randomUseragent.getRandom(),
        'Origin': 'https://enso.brianknows.org',
        'Referer': `https://enso.brianknows.org/search?userId=${address}`,
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.post('https://enso.brianknows.org/api/auth/verify', { message, signature }, config);
    const cookies = response.headers['set-cookie'] || [];
    const tokenMatch = cookies.find(cookie => cookie.includes('brian-token='));
    const token = tokenMatch ? tokenMatch.split('brian-token=')[1].split(';')[0] : null;
    if (!token) throw new Error('brian-token not found');
    spinner.succeed(chalk.green(` ┊ ✓ Verification successful: brian-token=${token.slice(0, 10)}...; address=${address.slice(0, 8)}...`));
    await sleep(100);
    return { token, address, cookies };
  } catch (err) {
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Verifying account (Retry ${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return verify(message, signature, address, proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Verification failed: ${err.message}`));
    throw err;
  }
}

async function getAccountInfo(token, address, proxy = null, retryCount = 0) {
  const maxRetries = 5;
  const spinner = ora({ text: chalk.cyan(` ┊ → Fetching account info${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    const cookie = `brian-address=${address}; brian-token=${token}; ph_phc_NfMuib33NsuSeHbpu42Ng91vE5X6J1amefUiuVgwx5y_posthog={"distinct_id":"0196a6af-e55f-79aa-9eda-0bc979d7345e","$sesid":[1746600342091,"0196a97c-daff-7ede-b8ef-c6f03e5cb2e4",1746600254207],"$initial_person_info":{"r":"https://speedrun.enso.build/","u":"https://enso.brianknows.org/search?userId=${address}"}}`;
    let config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': randomUseragent.getRandom(),
        'Cookie': cookie,
        'Origin': 'https://enso.brianknows.org',
        'Referer': `https://enso.brianknows.org/search?userId=${address}`,
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.get('https://enso.brianknows.org/api/auth/me', config);
    spinner.succeed(chalk.green(` ┊ ✓ Login: ${response.data.account.address.slice(0, 8)}...${response.data.account.address.slice(-6)}`));
    await sleep(100);
    return response.data;
  } catch (err) {
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Fetching account info (Retry ${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return getAccountInfo(token, address, proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Failed to fetch account info: ${err.message}`));
    throw err;
  }
}

async function getUserInfo(zealyUserId, proxy = null, retryCount = 0) {
  const maxRetries = 3;
  const spinner = ora({ text: chalk.cyan(` ┊ → Fetching user info (Zealy ID: ${zealyUserId.slice(0, 8)}...)${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.7',
        'content-type': 'application/json',
        'priority': 'u=1, i',
        'sec-ch-ua': randomUseragent.getRandom(),
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'Referer': 'https://speedrun.enso.build/campaign',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.get(`https://speedrun.enso.build/api/zealy/user/${zealyUserId}`, config);
    spinner.succeed(chalk.green(` ┊ ✓ User info received: ${response.data.name}`));
    await sleep(100);
    return {
      name: response.data.name || 'Unknown',
      connectedWallet: response.data.connectedWallet || 'Unknown',
      xp: response.data.xp || 0,
    };
  } catch (err) {
    const errorMsg = err.response ? `HTTP ${err.response.status}` : err.message;
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Fetching user info (Zealy ID: ${zealyUserId.slice(0, 8)}...) (Retry ${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return getUserInfo(zealyUserId, proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Failed to fetch user info: ${errorMsg}`));
    return {
      name: 'Unknown',
      connectedWallet: 'Unknown',
      xp: 0,
    };
  }
}

async function performChat(token, query, address, messages, proxy = null, retryCount = 0) {
  const maxRetries = 5;
  const spinner = ora({ text: chalk.cyan(` ┊ → Sending chat...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    const cookie = `brian-address=${address}; brian-token=${token}; ph_phc_NfMuib33NsuSeHbpu42Ng91vE5X6J1amefUiuVgwx5y_posthog={"distinct_id":"0196a6af-e55f-79aa-9eda-0bc979d7345e","$sesid":[1746600342091,"0196a97c-daff-7ede-b8ef-c6f03e5cb2e4",1746600254207],"$initial_person_info":{"r":"https://speedrun.enso.build/","u":"https://enso.brianknows.org/search?userId=${address}"}}`;
    const payload = { query, kbId: 'b4393b93-e603-426d-8b9f-0af145498c92' };
    let config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': randomUseragent.getRandom(),
        'Cookie': cookie,
        'Origin': 'https://enso.brianknows.org',
        'Referer': `https://enso.brianknows.org/search?userId=${address}`,
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.post('https://enso.brianknows.org/api/search', payload, config);
    spinner.succeed(chalk.green(' ┊ ✓ Chat sent'));
    await sleep(100);
    return response.data.answer;
  } catch (err) {
    const errorMsg = err.response ? `HTTP ${err.response.status}` : err.message;
    if (retryCount < maxRetries - 1) {
      spinner.stop();
      console.log(chalk.cyan(` ┊ → Sending chat (Retry ${retryCount + 1}/${maxRetries})...`));
      await sleep(500);
      return performChat(token, query, address, messages, proxy, retryCount + 1);
    }
    spinner.stop();
    if (err.response && err.response.data) {
      console.log(chalk.gray(` ┊ ℹ️ Server error details: ${JSON.stringify(err.response.data)}`));
    }
    const newQuery = messages[Math.floor(Math.random() * messages.length)];
    console.log(chalk.yellow(` ┊ ⚠️ All retries failed. Trying new query: ${newQuery}`));
    await sleep(5000);
    return performChat(token, newQuery, address, messages, proxy, 0);
  }
}

function generateProjectSlug() {
  const words = [
    'lucky', 'star', 'nova', 'cool', 'hoki', 'prime', 'sky', 'neo', 'blaze', 'tech',
    'moon', 'pulse', 'vibe', 'spark', 'glow', 'ace', 'zen', 'flash', 'bolt', 'wave',
    'fire', 'storm', 'dream', 'edge', 'flow', 'peak', 'rush', 'light', 'force', 'dash',
    'glint', 'surge', 'breeze', 'shade', 'frost', 'flame', 'core', 'drift', 'bloom', 'quest',
    'wind', 'tide', 'dawn', 'dusk', 'mist', 'cloud', 'ridge', 'vale', 'forge', 'link',
    'beam', 'spire', 'gleam', 'twist', 'loop', 'arc', 'vault', 'crux', 'nexus', 'orbit',
    'zest', 'chill', 'haze', 'glory', 'swift', 'bold', 'vivid', 'pure', 'clear', 'bright',
    'epic', 'grand', 'royal', 'noble', 'wild', 'free', 'soar', 'rise', 'shine', 'grow',
    'vapor', 'trail', 'echo', 'pulse', 'swing', 'shift', 'turn', 'blend', 'forge', 'craft',
    'seek', 'hunt', 'roam', 'drift', 'sail', 'climb', 'reach', 'touch', 'spark', 'ignite'
  ];
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${word1}-${word2}-${number}.widget`;
}

async function createDefiDex(projectSlug, address, zealyUserId, proxy = null, retryCount = 0) {
  const maxRetries = 3;
  const spinner = ora({ text: chalk.cyan(` ┊ → Creating DeFiDex: ${projectSlug}${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.7',
        'content-type': 'application/json',
        'priority': 'u=1, i',
        'sec-ch-ua': randomUseragent.getRandom(),
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'Referer': 'https://speedrun.enso.build/create/de-fi/shortcuts-widget',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const payload = {
      userId: address,
      projectSlug,
      zealyUserId,
      projectType: 'shortcuts-widget',
    };
    const response = await axios.post('https://speedrun.enso.build/api/track-project-creation', payload, config);
    if (response.data.success) {
      spinner.succeed(chalk.green(` ┊ ✓ DeFiDex created: ${projectSlug}`));
      await sleep(100);
      return true;
    } else if (response.data.code === 3) {
      spinner.stop();
      console.log(chalk.yellow(` ┊ ⚠️ Daily DeFiDex limit reached: ${response.data.message}`));
      await sleep(100);
      return false;
    } else {
      throw new Error(response.data.message || 'Failed to create DeFiDex');
    }
  } catch (err) {
    const errorMsg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || {})}` : err.message;
    if (err.response && err.response.data && err.response.data.code === 3) {
      spinner.stop();
      console.log(chalk.yellow(` ┊ ⚠️ Daily DeFiDex limit reached: ${err.response.data.message}`));
      await sleep(100);
      return false;
    }
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Creating DeFiDex: ${projectSlug} (Retry ${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return createDefiDex(projectSlug, address, zealyUserId, proxy, retryCount + 1);
    }
    if (err.response && err.response.data) {
      console.log(chalk.gray(` ┊ ℹ️ Server error details: ${JSON.stringify(err.response.data)}`));
    }
    spinner.fail(chalk.red(` ┊ ✗ Failed to create DeFiDex: ${errorMsg}`));
    await sleep(100);
    return false;
  }
}

async function getCampaigns(address, proxy = null, retryCount = 0) {
  const maxRetries = 3;
  const limit = 10;
  let allCampaigns = [];
  let page = 1;
  const spinner = ora({ text: chalk.cyan(` ┊ → Fetching campaign list (Page ${page})${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.7',
        'content-type': 'application/json',
        'priority': 'u=1, i',
        'sec-ch-ua': randomUseragent.getRandom(),
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'Referer': 'https://speedrun.enso.build/campaign',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }

    while (true) {
      const response = await axios.get(`https://speedrun.enso.build/api/get-campaigns?page=${page}&limit=${limit}&userId=${address}`, config);
      const { campaigns, total } = response.data;
      allCampaigns = allCampaigns.concat(campaigns);
      spinner.text = chalk.cyan(` ┊ → Fetching campaign list (Page ${page}/${Math.ceil(total / limit)})...`);
      if (page * limit >= total) break;
      page++;
      await sleep(2000);
    }

    spinner.succeed(chalk.green(` ┊ ✓ ${allCampaigns.length} campaigns found`));
    await sleep(100);
    return allCampaigns;
  } catch (err) {
    const errorMsg = err.response ? `HTTP ${err.response.status}` : err.message;
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Fetching campaign list (Retry ${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return getCampaigns(address, proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Failed to fetch campaign list: ${errorMsg}`));
    await sleep(100);
    return [];
  } finally {
    spinner.stop();
  }
}

async function completeCampaign(address, campaignId, campaignName, zealyUserId, proxy = null, retryCount = 0, spinner = null) {
  const maxRetries = 3;
  try {
    let config = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.7',
        'content-type': 'application/json',
        'priority': 'u=1, i',
        'sec-ch-ua': randomUseragent.getRandom(),
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'Referer': 'https://speedrun.enso.build/campaign',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const payload = {
      userId: address,
      campaignId,
      zealyUserId,
    };
    const response = await axios.post('https://speedrun.enso.build/api/track-campaign', payload, config);
    if (response.data.message === 'Points awarded and visit recorded') {
      return true;
    } else {
      throw new Error(response.data.message || 'Failed to complete campaign');
    }
  } catch (err) {
    const errorMsg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || {})}` : err.message;
    if (retryCount < maxRetries - 1) {
      await sleep(5000);
      return completeCampaign(address, campaignId, campaignName, zealyUserId, proxy, retryCount + 1, spinner);
    }
    if (spinner) {
      spinner.stop();
      console.log(chalk.red(` ┊ ✗ Failed to complete campaign ${campaignName} (ID: ${campaignId}): ${errorMsg}`));
      spinner.start();
    }
    return false;
  }
}

function displayCountdown(nextRun) {
  const interval = setInterval(() => {
    const now = moment().tz('Asia/Jakarta');
    const timeLeft = nextRun.diff(now);
    if (timeLeft <= 0) {
      clearInterval(interval);
      console.log(chalk.cyan(' ┊ ⏰ Next process time has arrived!'));
      return;
    }
    const duration = moment.duration(timeLeft);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    const seconds = duration.seconds();
    process.stdout.write(chalk.cyan(` ┊ ⏳ Waiting for next process: ${hours}:${minutes}:${seconds}\r`));
  }, 1000);
}

function calculateNextRun() {
  const now = moment().tz('Asia/Jakarta');
  const nextRun = moment().tz('Asia/Jakarta').set({ hour: 7, minute: 0, second: 0, millisecond: 0 });

  if (now.isSameOrAfter(nextRun)) {
    nextRun.add(1, 'day');
  }

  console.log(chalk.gray(` ┊ ℹ️ Next run calculated: ${nextRun.format('D/M/YYYY')}`));
  return nextRun;
}

async function processAccounts(accounts, messages, accountProxies, noType) {
  const INTERACTIONS = 5;
  const DEFIDEX_LIMIT = 5;
  let successCount = 0;
  let failCount = 0;
  let failedChats = 0;
  let successfulDexes = 0;
  let failedDexes = 0;
  let successfulCampaigns = 0;
  let failedCampaigns = 0;

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = accountProxies[i];
    const shortAddress = `${account.address.slice(0, 8)}...${account.address.slice(-6)}`;

    displayHeader(`═════[ Account ${i + 1}/${accounts.length} @ ${getTimestamp()} ]═════`, chalk.blue);

    const ip = await getPublicIP(proxy);

    let accountSuccess = true;
    let partialFailure = false;

    try {
      const nonce = await getNonce(proxy);
      const { message, signature } = await signMessage(account.privateKey, nonce, account.address);
      const { token } = await verify(message, signature, account.address, proxy);
      const accountInfo = await getAccountInfo(token, account.address, proxy);

      console.log(chalk.magentaBright(' ┊ ┌── Chat Process ──'));
      for (let j = 0; j < INTERACTIONS; j++) {
        console.log(chalk.yellow(` ┊ ├─ Chat ${createProgressBar(j + 1, INTERACTIONS)} ──`));
        const query = messages[Math.floor(Math.random() * messages.length)];
        console.log(chalk.white(` ┊ │ Message: ${query}`));
        const response = await performChat(token, query, account.address, messages, proxy);
        if (response.startsWith('Failed')) {
          failedChats++;
          partialFailure = true;
        }
        await typeText(response, response.startsWith('Failed') ? chalk.red : chalk.green, noType);
        await sleep(1000);
        console.log(chalk.yellow(' ┊ └──'));
        await sleep(3000);
      }
      console.log(chalk.yellow(' ┊ └──'));

      console.log(chalk.magentaBright(' ┊ ┌── DeFiDex Process ──'));
      for (let j = 0; j < DEFIDEX_LIMIT; j++) {
        console.log(chalk.yellow(` ┊ ├─ DeFiDex ${createProgressBar(j + 1, DEFIDEX_LIMIT)} ──`));
        const projectSlug = generateProjectSlug();
        console.log(chalk.white(` ┊ │ Project Slug: ${projectSlug}`));
        const success = await createDefiDex(projectSlug, account.address, account.zealyUserId, proxy);
        if (success) {
          successfulDexes++;
        } else {
          failedDexes++;
          partialFailure = true;
          if (!success && j === 0) break;
        }
        await sleep(1000);
      }
      console.log(chalk.yellow(' ┊ └──'));

      console.log(chalk.magentaBright(' ┊ ┌── Completing Campaigns Process ──'));
      const campaigns = await getCampaigns(account.address, proxy);
      if (campaigns.length === 0) {
        console.log(chalk.yellow(' ┊ │ Unable to fetch campaign list due to server error'));
        console.log(chalk.yellow(' ┊ └──'));
      } else {
        const pendingCampaigns = campaigns.filter(c => !c.visited && !c.pointsAwarded);
        if (pendingCampaigns.length === 0) {
          console.log(chalk.green(' ┊ │ All campaigns completed!'));
          console.log(chalk.yellow(' ┊ └──'));
        } else {
          console.log(chalk.white(` ┊ │ ${pendingCampaigns.length} pending campaigns found`));
          const spinner = ora({ text: chalk.cyan(` ┊ │ Processing campaigns: 0/${pendingCampaigns.length}...`), prefixText: '', spinner: 'bouncingBar' }).start();
          for (let j = 0; j < pendingCampaigns.length; j++) {
            const campaign = pendingCampaigns[j];
            const success = await completeCampaign(account.address, campaign.id, campaign.name, account.zealyUserId, proxy, 0, spinner);
            if (success) {
              successfulCampaigns++;
            } else {
              failedCampaigns++;
              partialFailure = true;
            }
            spinner.text = chalk.cyan(` ┊ │ Processing campaigns: ${j + 1}/${pendingCampaigns.length}...`);
            await sleep(1000);
          }
          spinner.succeed(chalk.green(` ┊ ✓ ${successfulCampaigns} of ${pendingCampaigns.length} campaigns completed`));
          console.log(chalk.yellow(' ┊ └──'));
        }
      }

      const userInfo = await getUserInfo(account.zealyUserId, proxy);
      console.log(chalk.yellow(' ┊ ┌── User Summary ──'));
      console.log(chalk.white(` ┊ │ Username: ${userInfo.name}`));
      console.log(chalk.white(` ┊ │ User Address: ${userInfo.connectedWallet}`));
      console.log(chalk.white(` ┊ │ Total XP: ${userInfo.xp}`));
      console.log(chalk.yellow(' ┊ └──'));
    } catch (err) {
      console.log(chalk.red(` ┊ ✗ Error: ${err.message}`));
      accountSuccess = false;
      failCount++;
    }

    if (accountSuccess) {
      successCount++;
    }
    console.log(chalk.gray(' ┊ ══════════════════════════════════════'));
  }

  displayHeader(`═════[ Completed @ ${getTimestamp()} ]═════`, chalk.blue);
  console.log(chalk.gray(` ┊ ✅ ${successCount} accounts successful, ❌ ${failCount} accounts failed`));
  if (failedChats > 0) {
    console.log(chalk.yellow(` ┊ ⚠️ ${failedChats} chats failed`));
  }
  if (failedCampaigns > 0) {
    console.log(chalk.yellow(` ┊ ⚠️ ${failedCampaigns} campaigns failed`));
  }
}

async function main() {
  console.log('\n');
  displayBanner();
  const noType = process.argv.includes('--no-type');
  let accounts = [];
  try {
    const accountsData = await fs.readFile('accounts.txt', 'utf8');
    const lines = accountsData.split('\n').filter(line => line.trim() !== '');
    for (let i = 0; i < lines.length; i++) {
      const [privateKey, zealyUserId] = lines[i].split(',').map(item => item.trim());
      if (!privateKey || !zealyUserId) {
        console.log(chalk.red(`✗ Line ${i + 1} in accounts.txt is incomplete: Must contain <privateKey>,<zealyUserId>`));
        rl.close();
        return;
      }
      if (!isValidPrivateKey(privateKey)) {
        console.log(chalk.red(`✗ privateKey on line ${i + 1} is invalid: ${privateKey}. Must be a 64-character hexadecimal.`));
        rl.close();
        return;
      }
      if (!isValidUUID(zealyUserId)) {
        console.log(chalk.red(`✗ zealyUserId on line ${i + 1} is invalid: ${zealyUserId}. Must be a UUID.`));
        rl.close();
        return;
      }
      const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
      accounts.push({
        address: wallet.address,
        privateKey,
        zealyUserId,
      });
    }
  } catch (err) {
    console.log(chalk.red('✗ File accounts.txt not found or empty! Ensure it contains <privateKey>,<zealyUserId> per line.'));
    rl.close();
    return;
  }

  if (accounts.length === 0) {
    console.log(chalk.red('✗ No valid accounts in accounts.txt!'));
    rl.close();
    return;
  }

  let messages = [];
  try {
    const msgData = await fs.readFile('message.txt', 'utf8');
    messages = msgData.split('\n').filter(line => line.trim() !== '');
  } catch (err) {
    console.log(chalk.red('✗ File message.txt not found or empty!'));
    rl.close();
    return;
  }

  let useProxy;
  while (true) {
    const input = await promptUser('Use proxy? (y/n) ');
    if (input.toLowerCase() === 'y' || input.toLowerCase() === 'n') {
      useProxy = input.toLowerCase() === 'y';
      break;
    } else {
      console.log(chalk.red('✗ Enter "y" or "n"!'));
    }
  }

  let proxies = [];
  if (useProxy) {
    try {
      const proxyData = await fs.readFile('proxy.txt', 'utf8');
      proxies = proxyData.split('\n').filter(line => line.trim() !== '');
    } catch (err) {
      console.log(chalk.yellow('✗ File proxy.txt not found. Proceeding without proxy. Ensure proxy.txt contains proxy list in format http://user:pass@host:port, one per line.'));
    }
  }

  const accountProxies = accounts.map((account, index) => {
    if (proxies.length > 0) {
      return proxies[index % proxies.length];
    } else {
      return null;
    }
  });

  console.log(chalk.cyan(` ┊ ⏰ Starting first account process...`));
  await processAccounts(accounts, messages, accountProxies, noType);

  const scheduleNextRun = async () => {
    const nextRun = calculateNextRun();
    displayCountdown(nextRun);
    schedule.scheduleJob(nextRun.toDate(), async () => {
      const currentTimeWIB = moment().tz('Asia/Jakarta').format('DD/MM/YYYY, HH:mm:ss');
      console.log(chalk.cyan(` ┊ ⏰ Process started at ${currentTimeWIB}`));
      await processAccounts(accounts, messages, accountProxies, noType);
      scheduleNextRun();
    });
  };

  scheduleNextRun();
}

main();
