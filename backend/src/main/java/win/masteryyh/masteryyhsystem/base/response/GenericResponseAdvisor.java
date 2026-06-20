package win.masteryyh.masteryyhsystem.base.response;

import jakarta.validation.ValidationException;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.validation.BindException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;
import tools.jackson.databind.ObjectMapper;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;

import java.util.StringJoiner;

@RestControllerAdvice
public class GenericResponseAdvisor implements ResponseBodyAdvice<Object> {
    private final ObjectMapper mapper;

    private static final Logger logger = LoggerFactory.getLogger(GenericResponseAdvisor.class);

    public GenericResponseAdvisor(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public boolean supports(MethodParameter returnType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return !returnType.hasMethodAnnotation(IgnoreResponseAdvice.class) &&
                !returnType.getContainingClass().isAnnotationPresent(IgnoreResponseAdvice.class);
    }

    @Override
    public @Nullable Object beforeBodyWrite(@Nullable Object body,
                                            MethodParameter returnType,
                                            MediaType selectedContentType,
                                            Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                            ServerHttpRequest request,
                                            ServerHttpResponse response) {
        return switch (body) {
            case null -> GenericResponse.ok();
            case GenericResponse<?> _ -> body;
            case String s -> mapper.writeValueAsString(GenericResponse.ok(s));
            case ResponseEntity<?> re -> {
                HttpStatusCode status = re.getStatusCode();
                yield new GenericResponse<>(status.value(), re.toString(), re.getBody());
            }
            case BusinessException e -> GenericResponse.failed(e.getCode(), e.getMessage());
            case Exception e -> {
                logger.error("An error occurred: ", e);
                yield GenericResponse.error();
            }
            default -> GenericResponse.ok(body);
        };
    }

    @ExceptionHandler(value = BusinessException.class)
    public GenericResponse<Void> businessExceptionHandler(BusinessException e) {
        return new GenericResponse<>(e.getCode(), e.getMessage(), null);
    }

    @ExceptionHandler(value = ValidationException.class)
    public GenericResponse<Void> validationExceptionHandler(ValidationException e) {
        return new GenericResponse<>(HttpStatus.BAD_REQUEST.value(), e.getMessage(), null);
    }

    @ExceptionHandler(value = BindException.class)
    public GenericResponse<Void> bindExceptionHandler(BindException e) {
        BindingResult br = e.getBindingResult();
        StringJoiner messageJoiner =
                new StringJoiner("; ", "Parameter validation failed: ", "");
        for (FieldError fieldError : br.getFieldErrors()) {
            messageJoiner.add(fieldError.getDefaultMessage());
        }
        return new GenericResponse<>(HttpStatus.BAD_REQUEST.value(), messageJoiner.toString(), null);
    }

    @ExceptionHandler(value = MethodArgumentNotValidException.class)
    public GenericResponse<Void> argumentNotValidExceptionHandler(MethodArgumentNotValidException e) {
        BindingResult br = e.getBindingResult();
        StringJoiner messageJoiner =
                new StringJoiner("; ", "Parameter validation failed: ", "");
        for (FieldError fieldError : br.getFieldErrors()) {
            messageJoiner.add(fieldError.getDefaultMessage());
        }
        return new GenericResponse<>(HttpStatus.BAD_REQUEST.value(), messageJoiner.toString(), null);
    }

    @ExceptionHandler(value = Exception.class)
    public GenericResponse<Void> exceptionHandler(BusinessException e) {
        logger.error("An error occurred: ", e);
        return GenericResponse.error();
    }
}
