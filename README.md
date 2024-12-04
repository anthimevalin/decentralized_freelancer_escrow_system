# decentralized_freelancer_escrow_system

Achieved Milestone
* Unit Tests work
* The first tests kinda works
* Contracts now fully functional except Random Arbitrator selection
* Might have to make voting obligatory / remove reputation if someone doesn't vote to avoid people not wanting to vote on ambiguous contracts -- but complicated since sometimes just 50% of the arbitrators have to vote to resolve the dispute


Next steps
* Question about how arbitrators get the necessary info to cast a vote --> Request info function and log everything
* Implement milestones
* Fees
* New concept for the voting and governance tokens
* Have a look at deadlines in the blockchain
* How should we decide when a vote ends and who participates? -- Randomized arbitrator selection not working, should arbitrators declare their interest in a vote? --> Low reputation only for small contracts and vice versa for large contracts


Comments for the report
+ Info exchange would happen off-chain
+ Ideally, there would be an app as a framework


FINAL TEST
+  Arbitrators can only concurrently vote on one dispute for each token they have
+  Log balances after multiple contracts
+  Log governance tokens after multiple contracts
