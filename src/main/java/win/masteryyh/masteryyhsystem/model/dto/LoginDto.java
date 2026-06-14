package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.hibernate.validator.constraints.Length;

public record LoginDto(@NotBlank(message = "Username cannot be blank") @Length(min = 1, max = 32, message = "Name length invalid") String name,
                       @NotEmpty(message = "Password cannot be empty") @Length(min = 6, message = "Password length invalid") String password) {
}
