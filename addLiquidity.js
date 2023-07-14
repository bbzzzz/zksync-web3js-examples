require("dotenv").config();
const { ethers } = require("ethers");
const { Wallet, Contract, Provider } = require("zksync-web3");

async function addLiquidity(ethAmount, usdcAmount) {
  const inputAmountETH = ethers.utils.parseEther(ethAmount.toString());
  const inputAmountUSDC = ethers.utils.parseUnits(usdcAmount.toString(), 6);

  const ethProvider = new ethers.providers.AlchemyProvider(
    "goerli",
    process.env.ALCHEMY_API_KEY
  );
  const zkSyncProvider = new Provider("https://zksync2-testnet.zksync.dev");
  const zkSyncWallet = new Wallet(
    process.env.PRIVATE_KEY,
    zkSyncProvider,
    ethProvider
  );

  // https://goerli.explorer.zksync.io/tokenlist
  // https://github.com/syncswap/weth
  const wETHAddress = "0x20b28B1e4665FFf290650586ad76E977EAb90c5D";
  const usdcAddress = "0x0faF6df7054946141266420b43783387A78d82A9";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  // SyncSwapRouter
  // https://syncswap.gitbook.io/api-documentation/resources/smart-contract#staging-testnet-recommended
  const routerAddress = "0xB3b7fCbb8Db37bC6f572634299A58f51622A847e";
  const poolFactoryAddress = "0xf2FD2bc2fBC12842aAb6FbB8b1159a6a83E72006";

  // https://gist.github.com/0xnakato/56cea29869fafb72d3c5e18c8160073d
  const classicPoolFactoryAbi = require("./abi/classicPoolFactoryAbi.json");
  const classicPoolAbi = require("./abi/classicPoolAbi.json");
  const routerAbi = require("./abi/routerAbi.json");

  const erc20Abi = [
    "function approve(address _spender, uint256 _value) public returns (bool success)",
    "function transfer(address _to, uint256 _value) public returns (bool success)",
    "function transferFrom(address _from, address _to, uint256 _value) public returns (bool success)",
    "function balanceOf(address _owner) public view returns (uint256 balance)",
    "function allowance(address _owner, address _spender) public view returns (uint256 remaining)",
  ];

  const classicPoolFactory = new Contract(
    poolFactoryAddress,
    classicPoolFactoryAbi,
    zkSyncProvider
  );

  // Gets the address of the ETH/USDC Classic Pool.
  // wETH is used internally by the pools.
  const poolAddress = await classicPoolFactory.getPool(
    wETHAddress,
    usdcAddress
  );

  // Checks whether the pool exists.
  if (poolAddress === ZERO_ADDRESS) {
    throw Error("Pool not exists");
  }

  // The router contract.
  const router = new Contract(routerAddress, routerAbi, zkSyncWallet);

  // Create contract instances for wETH and USDC
  const wETHContract = new Contract(wETHAddress, erc20Abi, zkSyncWallet);
  const usdcContract = new Contract(usdcAddress, erc20Abi, zkSyncWallet);

  // Approve the router to spend the input tokens.
  console.log("Approving WETH");
  const approveWETH = await wETHContract.approve(routerAddress, inputAmountETH);
  await approveWETH.wait();

  console.log("Approving USDC");
  const approveUSDC = await usdcContract.approve(
    routerAddress,
    inputAmountUSDC
  );
  await approveUSDC.wait();

  // Token inputs for adding liquidity
  const tokenInputs = [
    {
      token: wETHAddress,
      amount: inputAmountETH,
    },
    {
      token: usdcAddress,
      amount: inputAmountUSDC,
    },
  ];

  console.log(`Creating LP pair of ${ethAmount} ETH and ${usdcAmount} USDC`);

  const addLiquidityData = ethers.utils.defaultAbiCoder.encode(
    ["address"],
    [zkSyncWallet.address]
  ); // receiver address
  const callback = ZERO_ADDRESS; // Pass the zero address if no callback is needed
  const callbackData = "0x"; // Pass an empty bytes string if no callback data is needed

  // Executes the addLiquidity function.
  const tx = await router.addLiquidity(
    poolAddress,
    tokenInputs,
    addLiquidityData,
    1, // Minimum liquidity to receive, you can set this to ensure slippage tolerance
    callback,
    callbackData,
    { gasLimit: 1000000 }
  );

  console.log(`tx hash ${tx.hash}`);
  console.log(
    `view on explorer: https://goerli.explorer.zksync.io/tx/${tx.hash}`
  );

  try {
    const receipt = await tx.wait();
    console.log(receipt);
  } catch (error) {
    console.error(error);
  }
}

addLiquidity(0.00001, 100000);
