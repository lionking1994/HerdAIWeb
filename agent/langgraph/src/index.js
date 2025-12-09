const { WorkflowManager } = require('./../dist/graph');

async function main() {
    try {
        const workflowManager = new WorkflowManager();
        
        // Example queries
        const queries = [
            {
                question: "Please give me a love lyric with 10 letters",
                threadId: "thread_1"
            },
            {
                question: "Great",
                threadId: "thread_1"
            },
            {
                question: "Perfect",
                threadId: "thread_1"
            }
        ];

        for (const query of queries) {
            console.log("\n=== New Query ===");
            console.log("Question:", query.question);
            const result = await workflowManager.invoke(query.question, query.threadId);
            console.log("Answer:", result);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

main();