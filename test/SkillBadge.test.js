const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SkillBadge", function () {
    let skillBadge, owner, addr1, addr2;
    const MAX_BADGES = 10000;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        const SkillBadge = await ethers.getContractFactory("SkillBadge");
        skillBadge = await SkillBadge.deploy();
        await skillBadge.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await skillBadge.owner()).to.equal(owner.address);
        });

        it("Should have correct name and symbol", async function () {
            expect(await skillBadge.name()).to.equal("SkillBadge");
            expect(await skillBadge.symbol()).to.equal("SB");
        });
    });

    describe("Minting", function () {
        it("Should mint a badge with correct properties", async function () {
            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";

            const tx = await skillBadge.awardBadge(addr1.address, skillName, evidenceURI);
            const receipt = await tx.wait(1);
            
            const filter = skillBadge.filters.BadgeAwarded();
            const events = await skillBadge.queryFilter(filter);
            const tokenId = events[0].args.tokenId;

            const [storedSkillName, issuedDate, storedEvidenceURI] = await skillBadge.getBadgeInfo(tokenId);
            expect(storedSkillName).to.equal(skillName);
            expect(storedEvidenceURI).to.equal(evidenceURI);
            expect(await skillBadge.ownerOf(tokenId)).to.equal(addr1.address);
            expect(issuedDate).to.be.closeTo(Math.floor(Date.now() / 1000), 5); // ±5 segundos
        });

        it("Should fail to mint with invalid parameters", async function () {
            await expect(skillBadge.awardBadge(ethers.ZeroAddress, "Skill", "URI"))
                .to.be.revertedWith("Recipient cannot be zero address");
            await expect(skillBadge.awardBadge(addr1.address, "", "URI"))
                .to.be.revertedWith("Skill name cannot be empty");
            await expect(skillBadge.awardBadge(addr1.address, "Skill", ""))
                .to.be.revertedWith("Evidence URI cannot be empty");
        });

        it("Should not exceed maximum badges", async function () {
    // Mint 9999 badges (uno menos que el límite)
    for (let i = 0; i < 9999; i++) {
        await skillBadge.awardBadge(addr1.address, `Skill ${i}`, "URI");
    }

    // Intentamos mintar el badge 10000
    const tx = skillBadge.awardBadge(addr1.address, "Skill", "URI");
    await expect(tx).to.be.revertedWith("Maximum number of badges reached");
});
    });

    describe("Ownership", function () {
        it("Should allow owner to update badge evidence", async function () {
            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";
            const newEvidenceURI = "https://example.com/skills/solidity-developer-v2";

            const tx = await skillBadge.awardBadge(addr1.address, skillName, evidenceURI);
            const receipt = await tx.wait(1);
            
            const filter = skillBadge.filters.BadgeAwarded();
            const events = await skillBadge.queryFilter(filter);
            const tokenId = events[0].args.tokenId;

            await skillBadge.connect(owner).updateBadgeEvidence(tokenId, newEvidenceURI);
            const [, , storedEvidenceURI] = await skillBadge.getBadgeInfo(tokenId);
            expect(storedEvidenceURI).to.equal(newEvidenceURI);
        });

        it("Should prevent non-owner from updating badge evidence", async function () {
            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";
            const newEvidenceURI = "https://example.com/skills/solidity-developer-v2";

            const tx = await skillBadge.awardBadge(addr1.address, skillName, evidenceURI);
            const receipt = await tx.wait(1);
            
            const filter = skillBadge.filters.BadgeAwarded();
            const events = await skillBadge.queryFilter(filter);
            const tokenId = events[0].args.tokenId;

            await expect(skillBadge.connect(addr1).updateBadgeEvidence(tokenId, newEvidenceURI))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should transfer ownership correctly", async function () {
            await skillBadge.transferOwnership(addr2.address);
            expect(await skillBadge.owner()).to.equal(addr2.address);

            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";
            const newEvidenceURI = "https://example.com/skills/solidity-developer-v2";

            const tx = await skillBadge.connect(addr2).awardBadge(addr1.address, skillName, evidenceURI);
            const receipt = await tx.wait(1);
            
            const filter = skillBadge.filters.BadgeAwarded();
            const events = await skillBadge.queryFilter(filter);
            const tokenId = events[0].args.tokenId;

            await expect(skillBadge.connect(addr1).updateBadgeEvidence(tokenId, newEvidenceURI))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Events", function () {
        it("Should emit BadgeAwarded event on mint", async function () {
            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";

            const tx = await skillBadge.awardBadge(addr1.address, skillName, evidenceURI);
            const receipt = await tx.wait(1);

            const events = await skillBadge.queryFilter(skillBadge.filters.BadgeAwarded());
            const lastEvent = events[events.length - 1];
            
            expect(lastEvent.args.tokenId).to.equal(0); // El primer badge siempre es 0
            expect(lastEvent.args.recipient).to.equal(addr1.address);
            expect(lastEvent.args.skillName).to.equal(skillName);
            expect(lastEvent.args.issuedDate).to.be.greaterThan(0);
        });

        it("Should emit BadgeMetadataUpdated event on update", async function () {
            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";
            const newEvidenceURI = "https://example.com/skills/solidity-developer-v2";

            const tx = await skillBadge.awardBadge(addr1.address, skillName, evidenceURI);
            const receipt = await tx.wait(1);
            
            const filter = skillBadge.filters.BadgeAwarded();
            const events = await skillBadge.queryFilter(filter);
            const tokenId = events[0].args.tokenId;

            await expect(skillBadge.connect(owner).updateBadgeEvidence(tokenId, newEvidenceURI))
                .to.emit(skillBadge, "BadgeMetadataUpdated")
                .withArgs(tokenId, newEvidenceURI);
        });
    });

    describe("Token Management", function () {
        it("Should correctly track token IDs", async function () {
            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";

            // Mint first badge
            const tx1 = await skillBadge.awardBadge(addr1.address, skillName, evidenceURI);
            const receipt1 = await tx1.wait(1);
            
            const filter1 = skillBadge.filters.BadgeAwarded();
            const events1 = await skillBadge.queryFilter(filter1);
            const tokenId1 = events1[0].args.tokenId;

            // Mint second badge
            const tx2 = await skillBadge.awardBadge(addr2.address, skillName, evidenceURI);
            const receipt2 = await tx2.wait(1);
            
            const filter2 = skillBadge.filters.BadgeAwarded();
            const events2 = await skillBadge.queryFilter(filter2);
            const tokenId2 = events2[1].args.tokenId;

            expect(tokenId1).to.equal(0);
            expect(tokenId2).to.equal(1);
        });

        it("Should correctly track badge metadata", async function () {
            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";

            const tx = await skillBadge.awardBadge(addr1.address, skillName, evidenceURI);
            const receipt = await tx.wait(1);
            
            const filter = skillBadge.filters.BadgeAwarded();
            const events = await skillBadge.queryFilter(filter);
            const tokenId = events[0].args.tokenId;

            const [storedSkillName, issuedDate, storedEvidenceURI] = await skillBadge.getBadgeInfo(tokenId);
            expect(storedSkillName).to.equal(skillName);
            expect(storedEvidenceURI).to.equal(evidenceURI);
            expect(issuedDate).to.be.greaterThan(0);
        });
    });
});