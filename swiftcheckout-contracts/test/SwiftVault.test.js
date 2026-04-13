import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;


describe("SwiftVault on Kite Mainnet Fork", function () {
    let SwiftVault, vault;
    let MockERC20, lUsdc;
    let MockLucidController, lucidCtrl;
    let usdc;

    let owner, operator, feeRecipient, user, merchant;
    
    const USDC_ADDRESS = "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e";
    const USDC_LUCID_CONTROLLER = "0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b";
    const USDC_SLOT = 9;

    before(async function () {
        [owner, operator, feeRecipient, user, merchant] = await ethers.getSigners();

        // Deploy Mock L-USDC
        MockERC20 = await ethers.getContractFactory("MockERC20");
        lUsdc = await MockERC20.deploy("Lucid USDC", "L-USDC");
        await lUsdc.waitForDeployment();

        // Deploy Mock Lucid Controller
        MockLucidController = await ethers.getContractFactory("MockLucidController");
        lucidCtrl = await MockLucidController.deploy(USDC_ADDRESS, await lUsdc.getAddress());
        await lucidCtrl.waitForDeployment();

        // Deploy SwiftVault
        SwiftVault = await ethers.getContractFactory("SwiftVault");
        vault = await SwiftVault.deploy(
            USDC_ADDRESS,
            await lucidCtrl.getAddress(),
            await lUsdc.getAddress(),
            operator.address,
            feeRecipient.address
        );
        await vault.waitForDeployment();

        // Get USDC contract
        usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

        // Fund user and vault with USDC using storage manipulation
        await fundUSDC(user.address, ethers.parseUnits("1000", 6));
        await fundUSDC(await vault.getAddress(), ethers.parseUnits("5000", 6));

        // Register Merchant
        await vault.registerMerchant(merchant.address);
    });

    async function fundUSDC(target, amount) {
        const key = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [target, USDC_SLOT])
        );
        const hexAmount = ethers.zeroPadValue(ethers.toBeHex(amount), 32);
        await ethers.provider.send("hardhat_setStorageAt", [USDC_ADDRESS, key, hexAmount]);
    }

    describe("Initialization", function () {
        it("Should set correct initial parameters", async function () {
            expect(await vault.usdc()).to.equal(USDC_ADDRESS);
            expect(await vault.lucidController()).to.equal(await lucidCtrl.getAddress());
            expect(await vault.lUsdc()).to.equal(await lUsdc.getAddress());
            expect(await vault.operator()).to.equal(operator.address);
            expect(await vault.feeRecipient()).to.equal(feeRecipient.address);
            expect(await vault.bufferBps()).to.equal(2000n); // 20%
            expect(await vault.feeBps()).to.equal(50n); // 0.5%
        });

        it("Should show correct initial vault balances", async function () {
            const liquidBal = await vault.liquidBalance();
            expect(liquidBal).to.equal(ethers.parseUnits("5000", 6));
        });
    });

    describe("Onramp", function () {
        it("Should allow operator to settle onramp", async function () {
            const orderId = ethers.id("order-1");
            const usdcAmount = ethers.parseUnits("100", 6);
            const ngnAmount = 15000000n; // 150,000 NGN in kobo

            const userBalBefore = await usdc.balanceOf(user.address);
            const vaultBalBefore = await vault.liquidBalance();

            await expect(vault.connect(operator).settleOnramp(orderId, user.address, usdcAmount, ngnAmount))
                .to.emit(vault, "OnrampSettled")
                .withArgs(orderId, user.address, usdcAmount);

            const userBalAfter = await usdc.balanceOf(user.address);
            const vaultBalAfter = await vault.liquidBalance();

            expect(userBalAfter - userBalBefore).to.equal(usdcAmount);
            expect(vaultBalBefore - vaultBalAfter).to.equal(usdcAmount);

            const namespacedOrderId = ethers.keccak256(ethers.solidityPacked(["string", "bytes32"], ["ONRAMP", orderId]));
            const isSettled = await vault.isOrderSettled(namespacedOrderId);
            expect(isSettled).to.be.true;
        });

        it("Should prevent non-operator from settling onramp", async function () {
            const orderId = ethers.id("order-2");
            await expect(
                vault.connect(user).settleOnramp(orderId, user.address, 100, 100)
            ).to.be.revertedWith("Not operator");
        });
    });

    describe("Offramp", function () {
        it("Should allow user to initiate offramp", async function () {
            const orderId = ethers.id("order-3");
            const usdcAmount = ethers.parseUnits("100", 6);

            // User approves vault
            await usdc.connect(user).approve(await vault.getAddress(), usdcAmount);

            const fee = (usdcAmount * 50n) / 10000n;
            const netAmount = usdcAmount - fee;

            const vaultBalBefore = await vault.liquidBalance();
            const feeRecipientBalBefore = await usdc.balanceOf(feeRecipient.address);

            await expect(vault.connect(user).initiateOfframp(orderId, usdcAmount))
                .to.emit(vault, "OfframpInitiated")
                .withArgs(orderId, user.address, netAmount);

            const vaultBalAfter = await vault.liquidBalance();
            const feeRecipientBalAfter = await usdc.balanceOf(feeRecipient.address);

            expect(vaultBalAfter - vaultBalBefore).to.equal(netAmount);
            expect(feeRecipientBalAfter - feeRecipientBalBefore).to.equal(fee);
        });
    });

    describe("Checkout", function () {
        it("Should allow operator to settle checkout for registered merchant", async function () {
            const orderId = ethers.id("checkout-1");
            const usdcAmount = ethers.parseUnits("50", 6);
            const ngnAmount = 7500000n;

            const fee = (usdcAmount * 50n) / 10000n;
            const netAmount = usdcAmount - fee;

            const merchantBalBefore = await usdc.balanceOf(merchant.address);
            const feeRecipientBalBefore = await usdc.balanceOf(feeRecipient.address);

            await expect(vault.connect(operator).settleCheckout(orderId, merchant.address, usdcAmount, ngnAmount))
                .to.emit(vault, "CheckoutSettled")
                .withArgs(orderId, merchant.address, usdcAmount);

            const merchantBalAfter = await usdc.balanceOf(merchant.address);
            const feeRecipientBalAfter = await usdc.balanceOf(feeRecipient.address);

            expect(merchantBalAfter - merchantBalBefore).to.equal(netAmount);
            expect(feeRecipientBalAfter - feeRecipientBalBefore).to.equal(fee);
        });

        it("Should revert if merchant is not registered", async function () {
            const orderId = ethers.id("checkout-2");
            await expect(
                vault.connect(operator).settleCheckout(orderId, user.address, 100, 100)
            ).to.be.revertedWith("Merchant not registered");
        });
    });

    describe("Yield Management", function () {
        it("Should allow operator to deploy excess liquidity to yield", async function () {
            const tvl = await vault.totalTVL();
            const targetBuffer = (tvl * 2000n) / 10000n; // 20%
            const liquidBal = await vault.liquidBalance();
            const deployable = liquidBal - targetBuffer;

            await expect(vault.connect(operator).deployToYield())
                .to.emit(vault, "YieldDeployed")
                .withArgs(deployable);

            expect(await vault.liquidBalance()).to.equal(targetBuffer);
            expect(await vault.yieldBalance()).to.equal(deployable);
            expect(await lUsdc.balanceOf(await vault.getAddress())).to.equal(deployable);
        });

        it("Should revert if nothing to deploy", async function () {
            // Buffer is at exactly 20% right now, so nothing more to deploy
            await expect(vault.connect(operator).deployToYield())
                .to.be.revertedWith("Nothing to deploy");
        });

        it("Should allow operator to recall from yield", async function () {
            const recallAmount = ethers.parseUnits("500", 6);
            
            const liquidBefore = await vault.liquidBalance();
            const yieldBefore = await vault.yieldBalance();

            await expect(vault.connect(operator).recallFromYield(recallAmount))
                .to.emit(vault, "YieldRecalled")
                .withArgs(recallAmount);

            const liquidAfter = await vault.liquidBalance();
            const yieldAfter = await vault.yieldBalance();

            expect(liquidAfter - liquidBefore).to.equal(recallAmount);
            expect(yieldBefore - yieldAfter).to.equal(recallAmount);
        });
    });

    describe("Admin functions", function () {
        it("Should allow owner to change operator", async function () {
            await expect(vault.connect(owner).setOperator(user.address))
                .to.emit(vault, "OperatorUpdated")
                .withArgs(user.address);
            
            expect(await vault.operator()).to.equal(user.address);
            
            // Revert back
            await vault.connect(owner).setOperator(operator.address);
        });

        it("Should allow owner to pause and unpause", async function () {
            await vault.connect(owner).pause();
            
            await expect(
                vault.connect(operator).settleOnramp(ethers.id("paused-1"), user.address, 100, 100)
            ).to.be.revertedWithCustomError(vault, "EnforcedPause");

            await vault.connect(owner).unpause();
        });
    });
});
