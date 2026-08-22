import schedule from 'node-schedule';

const countdownJobs = new Map();

export async function sendReactionWaitingCountdown(api, message, count, commandName) {
    const messages = Array(count).fill(message);
    const messageId = message.data.cliMsgId || Date.now().toString();
    const senderId = message.data.uidFrom;

    const jobKey = `${senderId}_${commandName}`;

    for (const [key, value] of countdownJobs.entries()) {
        if (value.jobKeyCommand === jobKey) {
            value.job.shouldStop = true;
            countdownJobs.delete(key);
        }
    }

    const date = new Date(Date.now() + 500);

    const job = schedule.scheduleJob(date, async () => {
        try {
            job.shouldStop = false;
            while (messages.length > 0 && !job.shouldStop) {
                try {
                    await api.addReaction("CLOCK", messages);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await api.addReaction("UNDO", messages);
                } catch (error) {
                }
                messages.splice(0, 1);
            }
        } catch (error) {
            console.error(`Error in countdown job ${messageId}:`, error);
        } finally {
            job.cancel();
            countdownJobs.delete(jobKey);
        }
    });

    countdownJobs.set(jobKey + Date.now().toString(), {
        job: job,
        jobKeyCommand: jobKey
    });
}