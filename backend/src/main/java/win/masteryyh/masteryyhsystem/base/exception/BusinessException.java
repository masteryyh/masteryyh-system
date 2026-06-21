package win.masteryyh.masteryyhsystem.base.exception;

import lombok.EqualsAndHashCode;
import lombok.Getter;

@EqualsAndHashCode(callSuper = true)
@Getter
public class BusinessException extends RuntimeException {
    private final int code;

    /**
     * i18n key 用于前端做多语言翻译，例如 {@code error.credential.notFound}。
     * 历史调用未指定 key 时可为 {@code null}，由前端走 fallback message。
     */
    private final String messageKey;

    /**
     * 英文/开发者可读的兜底信息，进入日志与 {@code GenericResponse.message}，
     * 当前端未匹配 key 时直接展示。
     */
    private final String message;

    public BusinessException(int code, String messageKey, String fallbackMessage) {
        super(fallbackMessage);
        this.code = code;
        this.messageKey = messageKey;
        this.message = fallbackMessage;
    }

    /**
     * 兼容历史调用：未携带 i18n key，由前端走 fallback message。
     */
    public BusinessException(int code, String message) {
        this(code, null, message);
    }
}
