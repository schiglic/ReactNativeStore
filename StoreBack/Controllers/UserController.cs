using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using StoreBack.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.IO;

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
            public string UserName { get; set; }
            public string Password { get; set; }
            public IFormFile? ProfilePicture { get; set; } // Зробимо необов’язковим
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromForm] RegisterModel model)
        {
            Console.WriteLine($"Received register request: UserName={model.UserName}, Password={model.Password}, ProfilePicture={model.ProfilePicture?.FileName ?? "null"}");

            if (string.IsNullOrEmpty(model.UserName) || string.IsNullOrEmpty(model.Password))
            {
                Console.WriteLine("Username or password is missing");
                return BadRequest(new { error = "Username and password are required" });
            }

            var user = new ApplicationUser
            {
                UserName = model.UserName,
                Email = null,
                PhoneNumber = null
            };

            if (model.ProfilePicture != null)
            {
                var profilePicturesPath = Path.Combine(_environment.ContentRootPath, "profilePictures");
                if (!Directory.Exists(profilePicturesPath))
                    Directory.CreateDirectory(profilePicturesPath);

                var fileName = Guid.NewGuid().ToString() + Path.GetExtension(model.ProfilePicture.FileName);
                var filePath = Path.Combine(profilePicturesPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await model.ProfilePicture.CopyToAsync(stream);
                }

                user.ProfilePicture = Path.Combine("profilePictures", fileName);
                Console.WriteLine($"Profile picture saved to: {user.ProfilePicture}");
            }
            else
            {
                Console.WriteLine("No profile picture provided");
                user.ProfilePicture = null;
            }

            var result = await _userManager.CreateAsync(user, model.Password);
            if (result.Succeeded)
            {
                await _signInManager.SignInAsync(user, isPersistent: false);
                Console.WriteLine("User registered successfully");
                return Ok(new { message = "User registered successfully" });
            }

            Console.WriteLine("Registration failed: " + string.Join(", ", result.Errors.Select(e => e.Description)));
            return BadRequest(new { error = "Registration failed", details = result.Errors.Select(e => e.Description) });
        }

        public class LoginModel
        {
            public string UserName { get; set; }
            public string Password { get; set; }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromForm] LoginModel model)
        {
            Console.WriteLine($"Login attempt: UserName={model.UserName}, Password=***");
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

            var result = await _signInManager.PasswordSignInAsync(model.UserName, model.Password, false, false);
            if (result.Succeeded)
            {
                var token = GenerateJwtToken(user);
                Console.WriteLine("Login successful");
                return Ok(new { token });
            }

            Console.WriteLine("Login failed: Invalid credentials");
            return Unauthorized(new { error = "Invalid username or password" });
        }

        public class EditProfileModel
        {
            public string PhoneNumber { get; set; }
            public IFormFile? ProfilePicture { get; set; } // Зробимо необов’язковим
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<IActionResult> EditProfile([FromForm] EditProfileModel model)
        {
            Console.WriteLine($"Edit profile request: PhoneNumber={model.PhoneNumber}, ProfilePicture={model.ProfilePicture?.FileName ?? "null"}");
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return NotFound(new { error = "User not found" });
            }

            user.PhoneNumber = model.PhoneNumber;

            if (model.ProfilePicture != null)
            {
                var profilePicturesPath = Path.Combine(_environment.ContentRootPath, "profilePictures");
                if (!Directory.Exists(profilePicturesPath))
                    Directory.CreateDirectory(profilePicturesPath);

                var fileName = Guid.NewGuid().ToString() + Path.GetExtension(model.ProfilePicture.FileName);
                var filePath = Path.Combine(profilePicturesPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await model.ProfilePicture.CopyToAsync(stream);
                }

                user.ProfilePicture = Path.Combine("profilePictures", fileName);
                Console.WriteLine($"Profile picture updated to: {user.ProfilePicture}");
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
        [HttpDelete("delete")]
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