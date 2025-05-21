using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoreBack.Data;
using StoreBack.Models;
using System.IO;

namespace StoreBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ProductController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IWebHostEnvironment _environment;

        public ProductController(ApplicationDbContext context, UserManager<ApplicationUser> userManager, IWebHostEnvironment environment)
        {
            _context = context;
            _userManager = userManager;
            _environment = environment;
        }

        public class ProductCreateModel
        {
            public string Name { get; set; }
            public decimal Price { get; set; }
            public string ImageBase64 { get; set; }
            public string Description { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromForm] ProductCreateModel model)
        {
            Console.WriteLine($"Received product create request: Name={model.Name ?? "null"}, Price={model.Price}, Description={model.Description ?? "null"}, ImageBase64={(model.ImageBase64 != null ? $"Length: {model.ImageBase64.Length}" : "null")}");

            if (string.IsNullOrEmpty(model.ImageBase64))
            {
                Console.WriteLine("ImageBase64 is required");
                return BadRequest("ImageBase64 is required");
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return Unauthorized("User not found");
            }

            string imagePath;
            try
            {
                var imagesPath = Path.Combine(_environment.ContentRootPath, "images");
                if (!Directory.Exists(imagesPath))
                    Directory.CreateDirectory(imagesPath);

                var fileName = Guid.NewGuid().ToString() + ".jpg";
                var filePath = Path.Combine(imagesPath, fileName);

                var bytes = Convert.FromBase64String(model.ImageBase64);
                await System.IO.File.WriteAllBytesAsync(filePath, bytes);

                imagePath = Path.Combine("images", fileName);
                Console.WriteLine($"Image saved to: {imagePath}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error saving image: {ex.Message}");
                return BadRequest(new { error = "Failed to save image", details = ex.Message });
            }

            var product = new Product
            {
                Name = model.Name,
                Price = model.Price,
                Image = imagePath,
                Description = model.Description,
                UserId = user.Id
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            Console.WriteLine("Product created successfully");
            return Ok(product);
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            Console.WriteLine("Received GET /product request");
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return Unauthorized();
            }

            var products = await _context.Products
                .Include(p => p.User)
                .Where(p => p.UserId == user.Id)
                .ToListAsync();
            Console.WriteLine($"Returning {products.Count} products for user {user.UserName}");
            return Ok(products);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            Console.WriteLine($"Received GET /product/{id} request");
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return Unauthorized();
            }

            var product = await _context.Products
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == user.Id);
            if (product == null)
            {
                Console.WriteLine("Product not found or not owned by user");
                return NotFound();
            }
            Console.WriteLine("Product found");
            return Ok(product);
        }

        public class ProductUpdateModel
        {
            public string Name { get; set; }
            public decimal Price { get; set; }
            public string ImageBase64 { get; set; }
            public string Description { get; set; }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromForm] ProductUpdateModel model)
        {
            Console.WriteLine($"Received PUT /product/{id} request: Name={model.Name ?? "null"}, Price={model.Price}, Description={model.Description ?? "null"}, ImageBase64={(model.ImageBase64 != null ? $"Length: {model.ImageBase64.Length}" : "null")}");

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return Unauthorized();
            }

            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                Console.WriteLine("Product not found");
                return NotFound();
            }

            if (product.UserId != user.Id)
            {
                Console.WriteLine("User not authorized to update this product");
                return Forbid();
            }

            product.Name = model.Name;
            product.Price = model.Price;
            product.Description = model.Description;

            if (!string.IsNullOrEmpty(model.ImageBase64))
            {
                try
                {
                    var imagesPath = Path.Combine(_environment.ContentRootPath, "images");
                    if (!Directory.Exists(imagesPath))
                        Directory.CreateDirectory(imagesPath);

                    var fileName = Guid.NewGuid().ToString() + ".jpg";
                    var filePath = Path.Combine(imagesPath, fileName);

                    var bytes = Convert.FromBase64String(model.ImageBase64);
                    await System.IO.File.WriteAllBytesAsync(filePath, bytes);

                    product.Image = Path.Combine("images", fileName);
                    Console.WriteLine($"Image updated to: {product.Image}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error updating image: {ex.Message}");
                    return BadRequest(new { error = "Failed to update image", details = ex.Message });
                }
            }

            await _context.SaveChangesAsync();
            Console.WriteLine("Product updated successfully");
            return Ok(product);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            Console.WriteLine($"Received DELETE /product/{id} request");
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("User not found");
                return Unauthorized();
            }

            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                Console.WriteLine("Product not found");
                return NotFound();
            }

            if (product.UserId != user.Id)
            {
                Console.WriteLine("User not authorized to delete this product");
                return Forbid();
            }

            _context.Products.Remove(product);
            await _context.SaveChangesAsync();
            Console.WriteLine("Product deleted successfully");
            return Ok(new { message = "Product deleted" });
        }
    }
}