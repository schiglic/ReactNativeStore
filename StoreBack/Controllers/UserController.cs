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

        public UserController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager, IConfiguration configuration, IWebHostEnvironment environment)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _configuration = configuration;
            _environment = environment;
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
                Email = model.Email,
                PhoneNumber = model.PhoneNumber,
                UserName = model.UserName // Встановлюємо UserName для ApplicationUser
            };

            // Встановлюємо UserName і NormalizedUserName для базового класу IdentityUser
            ((IdentityUser)user).UserName = model.UserName;
            user.NormalizedUserName = model.UserName.ToUpper();

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

            Console.WriteLine($"Creating user with UserName={user.UserName}, BaseIdentityUserName={((IdentityUser)user).UserName}, NormalizedUserName={user.NormalizedUserName}, PhoneNumber={user.PhoneNumber}, Email={user.Email}");
            var result = await _userManager.CreateAsync(user, model.Password);
            if (result.Succeeded)
            {
                // Дебаг: Перевіряємо після створення
                var createdUser = await _userManager.FindByNameAsync(model.UserName);
                Console.WriteLine($"User created. UserName={createdUser?.UserName ?? "null"}, BaseIdentityUserName={((IdentityUser)createdUser)?.UserName ?? "null"}, NormalizedUserName={createdUser?.NormalizedUserName ?? "null"}, PasswordHash={createdUser?.PasswordHash ?? "null"}");

                await _signInManager.SignInAsync(user, isPersistent: false);
                Console.WriteLine("User registered successfully");
                return Ok(new { message = "User registered successfully" });
            }

            Console.WriteLine("Registration failed: " + string.Join(", ", result.Errors.Select(e => e.Description)));
            return BadRequest(new { error = "Registration failed", details = result.Errors.Select(e => e.Description) });
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

                // Переконаємося, що NormalizedUserName встановлено
                var user = await _userManager.FindByNameAsync(model.UserName);
                if (user == null)
                {
                    Console.WriteLine("User not found");
                    return Unauthorized(new { error = "User not found" });
                }

                // Перевіряємо і виправляємо NormalizedUserName, якщо воно null
                if (string.IsNullOrEmpty(user.NormalizedUserName))
                {
                    user.NormalizedUserName = user.UserName.ToUpper();
                    var updateResult = await _userManager.UpdateAsync(user);
                    if (!updateResult.Succeeded)
                    {
                        Console.WriteLine("Failed to update NormalizedUserName: " + string.Join(", ", updateResult.Errors.Select(e => e.Description)));
                        return StatusCode(500, new { error = "Failed to update user data" });
                    }
                    Console.WriteLine("NormalizedUserName was null, updated to: " + user.NormalizedUserName);
                }

                Console.WriteLine($"User found: UserName={user.UserName ?? "null"}, BaseIdentityUserName={((IdentityUser)user).UserName ?? "null"}, NormalizedUserName={user.NormalizedUserName ?? "null"}, PasswordHash={user.PasswordHash ?? "null"}");
                var result = await _signInManager.PasswordSignInAsync(user.UserName, model.Password, false, false);
                if (result.Succeeded)
                {
                    var token = GenerateJwtToken(user);
                    Console.WriteLine("Login successful");
                    return Ok(new { token });
                }

                Console.WriteLine("Login failed: Invalid credentials");
                return Unauthorized(new { error = "Invalid username or password" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Login error: {ex.Message}\nStackTrace: {ex.StackTrace}");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        public class EditProfileModel
        {
            public string PhoneNumber { get; set; }
            public string Email { get; set; }
            public string? ProfilePictureBase64 { get; set; }
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<IActionResult> EditProfile([FromForm] EditProfileModel model)
        {
            Console.WriteLine($"Edit profile request: PhoneNumber={model.PhoneNumber}, Email={model.Email}, ProfilePictureBase64={(model.ProfilePictureBase64 != null ? $"Length: {model.ProfilePictureBase64.Length}" : "null")}");
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return NotFound(new { error = "User not found" });
            }

            user.PhoneNumber = model.PhoneNumber;
            user.Email = model.Email;

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
                    Console.WriteLine($"Profile picture updated to: {user.ProfilePicture}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error updating profile picture: {ex.Message}");
                    return BadRequest(new { error = "Failed to update profile picture", details = ex.Message });
                }
            }
            else if (string.IsNullOrEmpty(user.ProfilePicture))
            {
                return BadRequest(new { error = "Profile picture is required" });
            }

            var result = await _userManager.UpdateAsync(user);
            if (result.Succeeded)
            {
                Console.WriteLine("Profile updated successfully");
                return Ok(new { message = "Profile updated" });
            }

            Console.WriteLine("Profile update failed: " + string.Join(", ", result.Errors.Select(e => e.Description)));
            return BadRequest(new { error = "Profile update failed", details = result.Errors.Select(e => e.Description) });
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
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Name, user.UserName)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddDays(1),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}