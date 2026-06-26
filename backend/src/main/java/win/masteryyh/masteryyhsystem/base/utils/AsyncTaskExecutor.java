package win.masteryyh.masteryyhsystem.base.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AsyncTaskExecutor {
    private static final Logger logger = LoggerFactory.getLogger(AsyncTaskExecutor.class);

    private static final ExecutorService VIRTUAL_EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

    public static ExecutorService getInstance() {
        return VIRTUAL_EXECUTOR;
    }

    public static void shutdown() {
        VIRTUAL_EXECUTOR.shutdown();
    }

    public static void afterCommit(Runnable task) {
        Runnable safe = () -> {
            try {
                task.run();
            } catch (Throwable t) {
                logger.error("Async post-commit task failed: ", t);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    VIRTUAL_EXECUTOR.execute(safe);
                }
            });
        } else {
            VIRTUAL_EXECUTOR.execute(safe);
        }
    }

    public static void installDefaultUncaughtExceptionHandler() {
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) ->
                logger.error("Uncaught exception in thread {}: ", thread.getName(), throwable));
    }
}
