package win.masteryyh.masteryyhsystem.platform;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.base.utils.AsyncTaskExecutor;
import win.masteryyh.masteryyhsystem.model.AppPlatform;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;

public abstract class AbstractPlatformManager<C> {
    protected static final Logger logger = LoggerFactory.getLogger(AbstractPlatformManager.class);

    protected static final Duration MAINTAIN_INTERVAL = Duration.ofSeconds(5);
    protected static final int MAX_CONNECT_RETRIES = 5;

    private final Map<UUID, Connection<C>> connections = new ConcurrentHashMap<>();
    private final AtomicBoolean shutdownSignal = new AtomicBoolean(false);

    private Thread refresher;

    protected abstract List<AppPlatform> loadPlatforms();

    protected abstract C createClient(AppPlatform platform) throws Exception;

    protected abstract boolean isHealthy(C client);

    protected abstract void closeClient(C client);

    private String name() {
        return getClass().getSimpleName();
    }

    @PostConstruct
    public void init() {
        for (AppPlatform platform : loadPlatforms()) {
            AsyncTaskExecutor.getInstance().submit(() -> addPlatform(platform));
        }
        refresher = Thread.ofVirtual().name(name() + "-refresher").unstarted(this::refreshLoop);
        refresher.start();
    }

    @PreDestroy
    public void shutdown() {
        shutdownSignal.set(true);
        if (refresher != null) {
            refresher.interrupt();
        }
    }

    private void refreshLoop() {
        while (!shutdownSignal.get()) {
            try {
                maintainConnections();
            } catch (Exception e) {
                logger.warn("[{}] Error during connection maintenance: ", name(), e);
            }
            try {
                Thread.sleep(MAINTAIN_INTERVAL);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        connections.forEach((id, conn) -> closeQuietly(conn));
        connections.clear();
    }

    private void maintainConnections() {
        for (Connection<C> conn : connections.values()) {
            conn.lock.lock();
            try {
                if (conn.client != null && isHealthy(conn.client)) {
                    conn.healthy = true;
                    continue;
                }
                if (conn.client != null) {
                    tryClose(conn.client);
                    conn.client = null;
                }
                C newClient = connectWithRetry(conn.platform);
                // 重建期间平台可能已被 removePlatform 移除，丢弃新 client 避免泄漏。
                if (!connections.containsKey(conn.platform.getId())) {
                    if (newClient != null) {
                        tryClose(newClient);
                    }
                    continue;
                }
                if (newClient != null) {
                    conn.client = newClient;
                    conn.healthy = true;
                } else {
                    conn.healthy = false;
                }
            } finally {
                conn.lock.unlock();
            }
        }
    }

    public void addPlatform(AppPlatform platform) {
        Connection<C> conn = new Connection<>(platform);
        conn.lock.lock();
        try {
            if (connections.putIfAbsent(platform.getId(), conn) != null) {
                return;
            }
            C client = connectWithRetry(platform);
            conn.client = client;
            conn.healthy = client != null;
        } finally {
            conn.lock.unlock();
        }
    }

    public void removePlatform(UUID id) {
        Connection<C> conn = connections.remove(id);
        if (conn == null) {
            return;
        }
        conn.lock.lock();
        try {
            if (conn.client != null) {
                tryClose(conn.client);
                conn.client = null;
            }
        } finally {
            conn.lock.unlock();
        }
    }

    public boolean getStatus(UUID id) {
        Connection<C> conn = connections.get(id);
        if (conn == null) {
            logger.warn("[{}] Platform {} not found when requesting status", name(), id);
            return false;
        }
        return conn.healthy;
    }

    public Optional<C> getClient(UUID id) {
        Connection<C> conn = connections.get(id);
        if (conn == null) {
            throw new BusinessException(404, "Unknown platform id " + id);
        }
        if (!conn.healthy || conn.client == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(conn.client);
    }

    private C connectWithRetry(AppPlatform platform) {
        for (int i = 0; i < MAX_CONNECT_RETRIES; i++) {
            try {
                return createClient(platform);
            } catch (Exception e) {
                logger.warn("[{}] Failed to connect to platform {} (attempt {}/{}): ",
                        name(), platform.getName(), i + 1, MAX_CONNECT_RETRIES, e);
            }
        }
        logger.warn("[{}] Failed to connect to platform {} after {} retries.",
                name(), platform.getName(), MAX_CONNECT_RETRIES);
        return null;
    }

    private void tryClose(C client) {
        try {
            closeClient(client);
        } catch (Exception ignored) {
        }
    }

    private void closeQuietly(Connection<C> conn) {
        conn.lock.lock();
        try {
            if (conn.client != null) {
                tryClose(conn.client);
            }
        } finally {
            conn.lock.unlock();
        }
    }

    protected static final class Connection<C> {
        final AppPlatform platform;
        final ReentrantLock lock = new ReentrantLock();
        volatile C client;
        volatile boolean healthy;

        Connection(AppPlatform platform) {
            this.platform = platform;
        }
    }
}
