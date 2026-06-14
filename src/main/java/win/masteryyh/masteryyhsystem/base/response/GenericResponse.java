package win.masteryyh.masteryyhsystem.base.response;

import org.springframework.http.HttpStatus;

public record GenericResponse<T>(int code, String message, T data) {
    public static GenericResponse<Void> ok() {
        return new GenericResponse<>(HttpStatus.OK.value(), HttpStatus.OK.getReasonPhrase(), null);
    }

    public static <T> GenericResponse<T> ok(T data) {
        return new GenericResponse<>(HttpStatus.OK.value(), HttpStatus.OK.getReasonPhrase(), data);
    }

    public static GenericResponse<Void> failed(int code, String message) {
        return new GenericResponse<>(code, message, null);
    }

    public static GenericResponse<Void> error() {
        return failed(HttpStatus.INTERNAL_SERVER_ERROR.value(), HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase());
    }
}
