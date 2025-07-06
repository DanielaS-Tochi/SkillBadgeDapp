const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying SkillBadge contract...");

    // Deploy the SkillBadge contract
    const SkillBadge = await ethers.getContractFactory("SkillBadge");
    const skillBadge = await SkillBadge.deploy();
    await skillBadge.waitForDeployment();

    console.log("SkillBadge deployed to:", await skillBadge.getAddress());

    // Example: Award a test badge
    const skillName = "Solidity Developer";
    const evidenceURI = "https://example.com/skills/solidity-developer";
    
    console.log("\nAwarding test badge...");
    const [owner] = await ethers.getSigners();
    const tx = await skillBadge.awardBadge(owner.address, skillName, evidenceURI);
    const receipt = await tx.wait(1);  // Agregar el número de confirmaciones

    console.log("Badge awarded!");
    console.log("Transaction hash:", tx.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});