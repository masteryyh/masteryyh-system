package win.masteryyh.masteryyhsystem.base.page;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PageDataRequest(@NotNull(message = "Page cannot be null") @Min(value = 1, message = "Page cannot below 1") Integer page,
                              @NotNull(message = "Page size cannot be null") @Min(value = 1, message = "Page size cannot below 1") Integer pageSize) {
}
