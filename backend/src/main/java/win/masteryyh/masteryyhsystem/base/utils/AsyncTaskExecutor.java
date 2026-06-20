package win.masteryyh.masteryyhsystem.base.utils;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AsyncTaskExecutor {
    private static final ExecutorService VIRTUAL_EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

    public static ExecutorService getInstance() {
        return VIRTUAL_EXECUTOR;
    }

    public static void shutdown() {
        VIRTUAL_EXECUTOR.shutdown();
    }
}
