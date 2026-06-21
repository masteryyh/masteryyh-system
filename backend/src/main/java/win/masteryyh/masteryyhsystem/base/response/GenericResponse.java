package win.masteryyh.masteryyhsystem.base.response;

import org.springframework.http.HttpStatus;

public record GenericResponse<T>(int code, String message, String messageKey, T data) {
    public static GenericResponse<Void> ok() {
        return new GenericResponse<>(HttpStatus.OK.value(), HttpStatus.OK.getReasonPhrase(), null, null);
    }

    public static <T> GenericResponse<T> ok(T data) {
        return new GenericResponse<>(HttpStatus.OK.value(), HttpStatus.OK.getReasonPhrase(), null, data);
    }

    public static GenericResponse<Void> failed(int code, String message) {
        return new GenericResponse<>(code, message, null, null);
    }

    public static GenericResponse<Void> failed(int code, String messageKey, String message) {
        return new GenericResponse<>(code, message, messageKey, null);
    }

    public static GenericResponse<Void> error() {
        return failed(HttpStatus.INTERNAL_SERVER_ERROR.value(), HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase());
    }
}
