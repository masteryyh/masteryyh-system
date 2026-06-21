package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.hibernate.validator.constraints.Length;

public record LoginDto(@NotBlank(message = "validation.username.notBlank")
                       @Length(min = 1, max = 32, message = "validation.username.length") String name,
                       @NotEmpty(message = "validation.password.notEmpty")
                       @Length(min = 6, message = "validation.password.length") String password) {
}
