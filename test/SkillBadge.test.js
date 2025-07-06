const { expect, anyValue } = require("chai");
const { ethers } = require("hardhat");

describe("SkillBadge", function () {
    let skillBadge, owner, addr1, addr2;
    const MAX_BADGES = 10000;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        const SkillBadge = await ethers.getContractFactory("SkillBadge");
        skillBadge = await SkillBadge.deploy(0); // 0 = default 10,000
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
            // Desplegamos un contrato con un límite pequeño (3)
            const SkillBadgeFactory = await ethers.getContractFactory("SkillBadge");
            const smallLimit = 3;
            const skillBadgeLimited = await SkillBadgeFactory.deploy(smallLimit);
            await skillBadgeLimited.waitForDeployment();
            for (let i = 0; i < smallLimit; i++) {
                await skillBadgeLimited.awardBadge(addr1.address, `Skill ${i}`, "URI");
            }
            // Intentamos mintear el badge que excede el límite
            const tx = skillBadgeLimited.awardBadge(addr1.address, "Skill", "URI");
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

    describe("Endorsements", function () {
        let tokenId;
        beforeEach(async function () {
            const skillName = "Solidity Developer";
            const evidenceURI = "https://example.com/skills/solidity-developer";
            const tx = await skillBadge.awardBadge(addr1.address, skillName, evidenceURI);
            const receipt = await tx.wait(1);
            const filter = skillBadge.filters.BadgeAwarded();
            const events = await skillBadge.queryFilter(filter);
            tokenId = events[0].args.tokenId;
        });

        it("Should allow a user to endorse a badge", async function () {
            await expect(skillBadge.connect(addr2).endorseBadge(tokenId))
                .to.emit(skillBadge, "BadgeEndorsed")
                .withArgs(tokenId, addr2.address);
            const endorsers = await skillBadge.getEndorsers(tokenId);
            expect(endorsers).to.include(addr2.address);
        });

        it("Should not allow double endorsement by the same user", async function () {
            await skillBadge.connect(addr2).endorseBadge(tokenId);
            await expect(skillBadge.connect(addr2).endorseBadge(tokenId))
                .to.be.revertedWith("Already endorsed this badge");
        });

        it("Should not allow endorsement of a non-existent badge", async function () {
            await expect(skillBadge.connect(addr2).endorseBadge(9999))
                .to.be.revertedWith("Token does not exist");
        });

        it("Should return all endorsers for a badge", async function () {
            await skillBadge.connect(addr1).endorseBadge(tokenId);
            await skillBadge.connect(addr2).endorseBadge(tokenId);
            const endorsers = await skillBadge.getEndorsers(tokenId);
            expect(endorsers).to.include(addr1.address);
            expect(endorsers).to.include(addr2.address);
            expect(endorsers.length).to.equal(2);
        });
    });

    describe("Issuers", function () {
        let owner, issuer, nonIssuer, recipient, SkillBadge, skillBadge;
        beforeEach(async function () {
            [owner, issuer, nonIssuer, recipient] = await ethers.getSigners();
            SkillBadge = await ethers.getContractFactory("SkillBadge");
            skillBadge = await SkillBadge.deploy(0); // default limit
            await skillBadge.waitForDeployment();
        });

        it("Owner can add and remove issuers", async function () {
            await expect(skillBadge.connect(owner).addIssuer(issuer.address))
                .to.emit(skillBadge, "IssuerAdded").withArgs(issuer.address);
            expect(await skillBadge.isIssuer(issuer.address)).to.be.true;
            await expect(skillBadge.connect(owner).removeIssuer(issuer.address))
                .to.emit(skillBadge, "IssuerRemoved").withArgs(issuer.address);
            expect(await skillBadge.isIssuer(issuer.address)).to.be.false;
        });

        it("Non-owner cannot add or remove issuers", async function () {
            await expect(skillBadge.connect(nonIssuer).addIssuer(issuer.address))
                .to.be.revertedWith("Ownable: caller is not the owner");
            await skillBadge.connect(owner).addIssuer(issuer.address);
            await expect(skillBadge.connect(nonIssuer).removeIssuer(issuer.address))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Issuer can mint badges to non-issuer addresses", async function () {
            await skillBadge.connect(owner).addIssuer(issuer.address);
            const skillName = "React Developer";
            const evidenceURI = "https://example.com/skills/react-developer";
            const tx = await skillBadge.connect(issuer).awardBadge(recipient.address, skillName, evidenceURI);
            const receipt = await tx.wait();
            const event = receipt.logs
                .map(log => {
                    try { return skillBadge.interface.parseLog(log); } catch { return null; }
                })
                .find(e => e && e.name === "BadgeAwarded");
            expect(event).to.not.be.undefined;
            expect(event.args.recipient).to.equal(recipient.address);
            expect(event.args.skillName).to.equal(skillName);
        });

        it("Issuer cannot mint badges to themselves", async function () {
            await skillBadge.connect(owner).addIssuer(issuer.address);
            await expect(skillBadge.connect(issuer).awardBadge(issuer.address, "Skill", "URI"))
                .to.be.revertedWith("Issuers can only mint to non-issuer addresses");
        });

        it("Issuer cannot mint badges to other issuers", async function () {
            await skillBadge.connect(owner).addIssuer(issuer.address);
            await skillBadge.connect(owner).addIssuer(nonIssuer.address);
            await expect(skillBadge.connect(issuer).awardBadge(nonIssuer.address, "Skill", "URI"))
                .to.be.revertedWith("Issuers can only mint to non-issuer addresses");
        });

        it("Non-issuer cannot mint badges", async function () {
            const skillName = "Vue Developer";
            const evidenceURI = "https://example.com/skills/vue-developer";
            await expect(skillBadge.connect(nonIssuer).awardBadge(recipient.address, skillName, evidenceURI))
                .to.be.revertedWith("Not authorized to mint");
        });

        it("Owner can always mint badges to anyone", async function () {
            await skillBadge.connect(owner).addIssuer(issuer.address);
            const skillName = "Angular Developer";
            const evidenceURI = "https://example.com/skills/angular-developer";
            const tx = await skillBadge.connect(owner).awardBadge(issuer.address, skillName, evidenceURI);
            const receipt = await tx.wait();
            const event = receipt.logs
                .map(log => {
                    try { return skillBadge.interface.parseLog(log); } catch { return null; }
                })
                .find(e => e && e.name === "BadgeAwarded");
            expect(event).to.not.be.undefined;
            expect(event.args.recipient).to.equal(issuer.address);
            expect(event.args.skillName).to.equal(skillName);
        });

        it("isIssuer returns correct status", async function () {
            expect(await skillBadge.isIssuer(issuer.address)).to.be.false;
            await skillBadge.connect(owner).addIssuer(issuer.address);
            expect(await skillBadge.isIssuer(issuer.address)).to.be.true;
        });
    });
});