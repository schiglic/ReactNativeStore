using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using StoreBack.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.IO;
using System.ComponentModel.DataAnnotations;

namespace StoreBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;
        private readonly RoleManager<IdentityRole> _roleManager;

        public UserController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            IConfiguration configuration,
            IWebHostEnvironment environment,
            RoleManager<IdentityRole> roleManager)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _configuration = configuration;
            _environment = environment;
            _roleManager = roleManager;
        }

        public class RegisterModel
        {
            [Required]
            public string UserName { get; set; }
            [Required]
            public string Password { get; set; }
            [Required]
            public string PhoneNumber { get; set; }
            [Required]
            public string Email { get; set; }
            public string? ProfilePictureBase64 { get; set; }
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromForm] RegisterModel model)
        {
            Console.WriteLine($"Received register request: UserName={model.UserName ?? "null"}, Password={model.Password ?? "null"}, PhoneNumber={model.PhoneNumber ?? "null"}, Email={model.Email ?? "null"}, ProfilePictureBase64={(model.ProfilePictureBase64 != null ? $"Length: {model.ProfilePictureBase64.Length}" : "null")}");

            if (!ModelState.IsValid)
            {
                Console.WriteLine("Model state invalid: " + string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                return BadRequest(new { error = "Invalid model state", details = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) });
            }

            if (string.IsNullOrEmpty(model.UserName) || string.IsNullOrEmpty(model.Password) || string.IsNullOrEmpty(model.PhoneNumber) || string.IsNullOrEmpty(model.Email))
            {
                Console.WriteLine("Username, password, phone number, or email is missing");
                return BadRequest(new { error = "Username, password, phone number, and email are required" });
            }

            var user = new ApplicationUser
            {
                UserName = model.UserName,
                NormalizedUserName = model.UserName.ToUpper(),
                Email = model.Email,
                PhoneNumber = model.PhoneNumber
            };

            // Синхронізуємо базове поле IdentityUser.UserName
            ((IdentityUser)user).UserName = model.UserName;

            if (!string.IsNullOrEmpty(model.ProfilePictureBase64))
            {
                try
                {
                    var profilePicturesPath = Path.Combine(_environment.ContentRootPath, "profilePictures");
                    if (!Directory.Exists(profilePicturesPath))
                        Directory.CreateDirectory(profilePicturesPath);

                    var fileName = Guid.NewGuid().ToString() + ".jpg";
                    var filePath = Path.Combine(profilePicturesPath, fileName);

                    var bytes = Convert.FromBase64String(model.ProfilePictureBase64);
                    await System.IO.File.WriteAllBytesAsync(filePath, bytes);

                    user.ProfilePicture = Path.Combine("profilePictures", fileName);
                    Console.WriteLine($"Profile picture saved to: {user.ProfilePicture}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error saving profile picture: {ex.Message}");
                    return BadRequest(new { error = "Failed to save profile picture", details = ex.Message });
                }
            }
            else
            {
                Console.WriteLine("No profile picture provided");
                return BadRequest(new { error = "Profile picture is required" });
            }

            Console.WriteLine($"Creating user with UserName={user.UserName}, NormalizedUserName={user.NormalizedUserName}, PhoneNumber={user.PhoneNumber}, Email={user.Email}");
            var createResult = await _userManager.CreateAsync(user, model.Password);
            if (createResult.Succeeded)
            {
                var createdUser = await _userManager.FindByNameAsync(model.UserName);
                Console.WriteLine($"User created. UserName={createdUser?.UserName ?? "null"}, NormalizedUserName={createdUser?.NormalizedUserName ?? "null"}, PasswordHash={createdUser?.PasswordHash ?? "null"}");

                // Присвоєння ролі "User"
                if (await _roleManager.RoleExistsAsync("User"))
                {
                    await _userManager.AddToRoleAsync(createdUser, "User");
                    Console.WriteLine($"Role 'User' assigned to {createdUser?.UserName}");
                }
                else
                {
                    Console.WriteLine("Role 'User' does not exist");
                }

                // Генеруємо токен після реєстрації
                var token = GenerateJwtToken(createdUser);
                Console.WriteLine("User registered successfully");
                return Ok(new { message = "User registered successfully", token });
            }

            Console.WriteLine("Registration failed: " + string.Join(", ", createResult.Errors.Select(e => e.Description)));
            return BadRequest(new { error = "Registration failed", details = createResult.Errors.Select(e => e.Description) });
        }

        public class LoginModel
        {
            [Required]
            public string UserName { get; set; }
            [Required]
            public string Password { get; set; }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromForm] LoginModel model)
        {
            try
            {
                Console.WriteLine($"Login attempt: UserName={model.UserName ?? "null"}, Password={(string.IsNullOrEmpty(model.Password) ? "null" : "***")}");
                if (!ModelState.IsValid)
                {
                    Console.WriteLine("Model state invalid: " + string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                    return BadRequest(new { error = "Invalid model state", details = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) });
                }

                if (string.IsNullOrEmpty(model.UserName) || string.IsNullOrEmpty(model.Password))
                {
                    Console.WriteLine("Username or password is missing");
                    return BadRequest(new { error = "Username and password are required" });
                }

                var user = await _userManager.FindByNameAsync(model.UserName);
                if (user == null)
                {
                    Console.WriteLine("User not found");
                    return Unauthorized(new { error = "User not found" });
                }

                // Перевірка та оновлення UserName, якщо базове поле пусте
                if (string.IsNullOrEmpty(((IdentityUser)user).UserName))
                {
                    ((IdentityUser)user).UserName = model.UserName;
                    user.UserName = model.UserName;
                    var updateResult = await _userManager.UpdateAsync(user);
                    if (!updateResult.Succeeded)
                    {
                        Console.WriteLine("Failed to update UserName: " + string.Join(", ", updateResult.Errors.Select(e => e.Description)));
                        return StatusCode(500, new { error = "Failed to update user data" });
                    }
                    Console.WriteLine("UserName was null, updated to: " + model.UserName);
                    user = await _userManager.FindByNameAsync(model.UserName);
                }

                // Перевірка NormalizedUserName
                if (string.IsNullOrEmpty(user.NormalizedUserName))
                {
                    user.NormalizedUserName = model.UserName.ToUpper();
                    var updateResult = await _userManager.UpdateAsync(user);
                    if (!updateResult.Succeeded)
                    {
                        Console.WriteLine("Failed to update NormalizedUserName: " + string.Join(", ", updateResult.Errors.Select(e => e.Description)));
                        return StatusCode(500, new { error = "Failed to update user data" });
                    }
                    Console.WriteLine("NormalizedUserName was null, updated to: " + user.NormalizedUserName);
                }

                Console.WriteLine($"User found: UserName={user.UserName ?? "null"}, NormalizedUserName={user.NormalizedUserName ?? "null"}, PasswordHash={user.PasswordHash ?? "null"}, Email={user.Email ?? "null"}, PhoneNumber={user.PhoneNumber ?? "null"}");

                // Спроба входу без SignInManager, щоб уникнути помилки Claims
                var passwordCheck = await _userManager.CheckPasswordAsync(user, model.Password);
                if (!passwordCheck)
                {
                    Console.WriteLine("Invalid credentials");
                    return Unauthorized(new { error = "Invalid username or password" });
                }

                var token = GenerateJwtToken(user);
                Console.WriteLine("Login successful");
                return Ok(new { token });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Login error: {ex.Message}\nStackTrace: {ex.StackTrace}");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        [HttpGet("profile")]
        [Authorize]
        public async Task<IActionResult> GetProfile()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return Unauthorized();
            }
            return Ok(new { user.UserName, user.ProfilePicture, user.PhoneNumber, user.Email });
        }

        public class EditProfileModel
        {
            public string? PhoneNumber { get; set; }
            public string? Email { get; set; }
            public string? ProfilePictureBase64 { get; set; }
            public string? OldPassword { get; set; }
            public string? NewPassword { get; set; }
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<IActionResult> EditProfile([FromForm] EditProfileModel model)
        {
            Console.WriteLine($"Edit profile request: PhoneNumber={model.PhoneNumber}, Email={model.Email}, ProfilePictureBase64={(model.ProfilePictureBase64 != null ? $"Length: {model.ProfilePictureBase64.Length}" : "null")}, OldPassword={(string.IsNullOrEmpty(model.OldPassword) ? "null" : "***")}, NewPassword={(string.IsNullOrEmpty(model.NewPassword) ? "null" : "***")}");

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return NotFound(new { error = "User not found" });
            }

            bool isUpdated = false;

            // Оновлення телефону
            if (!string.IsNullOrEmpty(model.PhoneNumber) && model.PhoneNumber != user.PhoneNumber)
            {
                user.PhoneNumber = model.PhoneNumber;
                isUpdated = true;
            }

            // Оновлення email
            if (!string.IsNullOrEmpty(model.Email) && model.Email != user.Email)
            {
                user.Email = model.Email;
                isUpdated = true;
            }

            // Оновлення пароля
            if (!string.IsNullOrEmpty(model.OldPassword) && !string.IsNullOrEmpty(model.NewPassword))
            {
                var passwordCheck = await _userManager.CheckPasswordAsync(user, model.OldPassword);
                if (!passwordCheck)
                {
                    Console.WriteLine("Old password is incorrect");
                    return BadRequest(new { error = "Неправильний старий пароль" });
                }
                var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                var passwordResult = await _userManager.ResetPasswordAsync(user, token, model.NewPassword);
                if (!passwordResult.Succeeded)
                {
                    Console.WriteLine("Password change failed: " + string.Join(", ", passwordResult.Errors.Select(e => e.Description)));
                    return BadRequest(new { error = "Не вдалося змінити пароль", details = passwordResult.Errors.Select(e => e.Description) });
                }
                Console.WriteLine("Password changed successfully");
                isUpdated = true;
            }

            // Оновлення аватарки
            if (!string.IsNullOrEmpty(model.ProfilePictureBase64))
            {
                try
                {
                    var profilePicturesPath = Path.Combine(_environment.ContentRootPath, "profilePictures");
                    if (!Directory.Exists(profilePicturesPath))
                        Directory.CreateDirectory(profilePicturesPath);

                    // Видаляємо стару аватарку, якщо вона існує
                    if (!string.IsNullOrEmpty(user.ProfilePicture))
                    {
                        var oldImagePath = Path.Combine(_environment.ContentRootPath, user.ProfilePicture);
                        if (System.IO.File.Exists(oldImagePath))
                        {
                            System.IO.File.Delete(oldImagePath);
                            Console.WriteLine($"Old profile picture deleted: {oldImagePath}");
                        }
                    }

                    var fileName = Guid.NewGuid().ToString() + ".jpg";
                    var filePath = Path.Combine(profilePicturesPath, fileName);

                    var bytes = Convert.FromBase64String(model.ProfilePictureBase64);
                    await System.IO.File.WriteAllBytesAsync(filePath, bytes);

                    user.ProfilePicture = Path.Combine("profilePictures", fileName);
                    Console.WriteLine($"Profile picture updated to: {user.ProfilePicture}");
                    isUpdated = true;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error updating profile picture: {ex.Message}");
                    return BadRequest(new { error = "Failed to update profile picture", details = ex.Message });
                }
            }

            if (isUpdated)
            {
                var updateResult = await _userManager.UpdateAsync(user);
                if (updateResult.Succeeded)
                {
                    Console.WriteLine("Profile updated successfully");
                    return Ok(new { message = "Profile updated" });
                }

                Console.WriteLine("Profile update failed: " + string.Join(", ", updateResult.Errors.Select(e => e.Description)));
                return BadRequest(new { error = "Profile update failed", details = updateResult.Errors.Select(e => e.Description) });
            }

            return Ok(new { message = "No changes to update" });
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            Console.WriteLine("Logout request received");
            await _signInManager.SignOutAsync();
            Console.WriteLine("User logged out");
            return Ok(new { message = "Logged out" });
        }

        [Authorize]
        [HttpPost("delete")]
        public async Task<IActionResult> DeleteAccount()
        {
            Console.WriteLine("Delete account request received");
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return NotFound(new { error = "User not found" });
            }

            var result = await _userManager.DeleteAsync(user);
            if (result.Succeeded)
            {
                Console.WriteLine("Account deleted successfully");
                return Ok(new { message = "Account deleted" });
            }

            Console.WriteLine("Account deletion failed: " + string.Join(", ", result.Errors.Select(e => e.Description)));
            return BadRequest(new { error = "Account deletion failed", details = result.Errors.Select(e => e.Description) });
        }

        private string GenerateJwtToken(ApplicationUser user)
        {
            var key = _configuration["Jwt:Key"];
            if (string.IsNullOrEmpty(key) || Encoding.UTF8.GetBytes(key).Length < 32)
            {
                Console.WriteLine("JWT Key is invalid or too short. It must be at least 32 bytes. Current length: " + (Encoding.UTF8.GetBytes(key ?? "").Length));
                throw new InvalidOperationException("JWT Key is invalid or too short. Please update appsettings.json with a key of at least 32 bytes.");
            }

            // Перевіряємо, що всі необхідні поля заповнені
            if (string.IsNullOrEmpty(user.Id))
            {
                Console.WriteLine("User Id is null");
                throw new InvalidOperationException("User Id cannot be null");
            }

            if (string.IsNullOrEmpty(user.UserName))
            {
                Console.WriteLine("UserName is null");
                throw new InvalidOperationException("UserName cannot be null");
            }

            // Отримуємо ролі користувача
            var roles = _userManager.GetRolesAsync(user).Result;
            var roleClaims = roles.Select(role => new Claim(ClaimTypes.Role, role)).ToList();

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Name, user.UserName)
            };
            claims.AddRange(roleClaims);

            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
            var creds = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"] ?? "StoreBack",
                audience: _configuration["Jwt:Audience"] ?? "StoreFront",
                claims: claims,
                expires: DateTime.Now.AddDays(1),
                signingCredentials: creds);

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
            Console.WriteLine($"Generated JWT token: {tokenString.Substring(0, 20)}... (length: {tokenString.Length})");
            return tokenString;
        }
    }
}